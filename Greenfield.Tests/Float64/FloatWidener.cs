#:package Mono.Cecil@0.11.6
// The version the test csproj references for the native-call shim: bump both together.

using System;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using Mono.Cecil;
using Mono.Cecil.Cil;
using Mono.Cecil.Rocks;

namespace Greenfield.Tests.Float64;

/// <summary>
/// <para>
/// Rewrites assemblies in place so that CoreCLR computes their float arithmetic the way Mono does
/// with its float32 optimization off (<c>-O=-float32</c>; Mono 6.14 has it on by default): float
/// values on the evaluation stack are doubles, and a store to a local, a field, an array element, a
/// pointer, an argument, or a return value narrows to float.
/// Each instruction pushing a float gets a <c>conv.r8</c> after it, and CoreCLR's JIT narrows
/// wherever a double reaches a float32 location.
/// </para>
/// <para>
/// The game's Mono computes floats that way outside Burst, as
/// <c>FloatPassTests.GameMath_RunsInThePassPrecision</c> records.
/// </para>
/// <para>
/// Run by Float64.targets on the float64 pass's test output, as a file-based app:
/// <c>dotnet run --file FloatWidener.cs -- [--references=&lt;dir&gt;]... &lt;file&gt;...</c>, each
/// file an assembly, or <c>@</c> and a file listing assemblies, one per line.
/// Cecil resolves an assembly's references next to it, then in the .NET runtime's folder, then in
/// each <c>--references</c> folder.
/// An assembly already rewritten carries the <see cref="FloatWidener.Marker"/> type and is skipped.
/// </para>
/// </summary>
internal static class FloatWidener {
  /// <summary>
  /// The type a rewritten assembly carries, which tests and scripts/check-float64-output.ts look
  /// for.
  /// </summary>
  private const string Marker = "<FloatWidened>";

  private const string ReferencesOption = "--references=";

  private static void Main(string[] args) {
    var references = args
      .Where(static arg => arg.StartsWith(FloatWidener.ReferencesOption))
      .Select(static arg => arg[FloatWidener.ReferencesOption.Length..])
      .ToArray();

    // A list file keeps the command short: cmd.exe, which runs MSBuild's Exec on Windows, cuts it
    // at 8191 characters.
    var paths = args
      .Where(static arg => !arg.StartsWith(FloatWidener.ReferencesOption))
      .SelectMany(static arg => arg.StartsWith('@')
        ? File.ReadAllLines(arg[1..]).Where(static line => line.Length > 0)
        : [arg]
      );

    foreach (var path in paths) {
      FloatWidener.Widen(path, references);
    }
  }

  private static void Widen(string path, string[] references) {
    var started = DateTime.UtcNow;
    var pdb = Path.ChangeExtension(path, ".pdb");
    var withSymbols = File.Exists(pdb);
    // A full file path always has a parent directory, so GetDirectoryName cannot return null.
    var directory = Path.GetDirectoryName(Path.GetFullPath(path))!;

    using var resolver = new InMemoryResolver();

    resolver.AddSearchDirectory(directory);

    // The test assembly's .NET references, before the game's folder: the game's System.Runtime is
    // an older facade that forwards only part of the framework (BindingFlags is missing).
    resolver.AddSearchDirectory(RuntimeEnvironment.GetRuntimeDirectory());

    foreach (var reference in references) {
      resolver.AddSearchDirectory(reference);
    }

    using var module = ModuleDefinition.ReadModule(
      path,
      new ReaderParameters {
        AssemblyResolver = resolver,
        ReadSymbols = withSymbols,
        InMemory = true
      }
    );

    if (module.GetType(FloatWidener.Marker) is not null) {
      Console.WriteLine($"{module.Name}: already widened");

      return;
    }

    var conversions = module.GetTypes()
      .SelectMany(static type => type.Methods)
      .Where(static method => method.HasBody)
      .Sum(static method => FloatWidener.WidenBody(method.Body));

    module.Types.Add(
      new TypeDefinition(
        "",
        FloatWidener.Marker,
        TypeAttributes.NotPublic | TypeAttributes.Abstract | TypeAttributes.Sealed,
        module.TypeSystem.Object
      )
    );

    // Written aside, then moved over the original: a move replaces the directory entry, so a copy
    // MSBuild hard-linked to the game's or the mod's assembly never rewrites that file.
    // Aside under its own name, which Cecil gives the pdb and records in the assembly for the
    // runtime to find it by.
    var aside = Directory.CreateDirectory(Path.Combine(directory, ".widening"));
    var temporary = Path.Combine(aside.FullName, Path.GetFileName(path));

    module.Write(temporary, new WriterParameters { WriteSymbols = withSymbols });

    File.Move(temporary, path, overwrite: true);

    if (withSymbols) {
      File.Move(Path.ChangeExtension(temporary, ".pdb"), pdb, overwrite: true);
    }

    // With what an interrupted run left there.
    aside.Delete(recursive: true);

    Console.WriteLine(
      $"{Path.GetFileName(path)}: {conversions} conv.r8 inserted " +
      $"({(DateTime.UtcNow - started).TotalMilliseconds:F0} ms)"
    );
  }

  private static int WidenBody(MethodBody body) {
    var conversions = 0;
    var il = body.GetILProcessor();

    body.SimplifyMacros();

    foreach (var instruction in body.Instructions.ToList()) {
      if (FloatWidener.PushesSingle(instruction)) {
        il.InsertAfter(instruction, il.Create(OpCodes.Conv_R8));
        conversions++;
      }
    }

    body.OptimizeMacros();

    return conversions;
  }

  /// <summary>
  /// Whether the instruction pushes a float32, which Mono would hold as a double.
  /// </summary>
  private static bool PushesSingle(Instruction instruction) =>
    instruction.OpCode.Code switch {
      Code.Ldc_R4 or Code.Ldelem_R4 or Code.Ldind_R4 or Code.Conv_R4 => true,
      Code.Ldloc => FloatWidener.IsSingle(((VariableDefinition) instruction.Operand).VariableType),
      Code.Ldarg => FloatWidener.IsSingle(
        ((ParameterDefinition) instruction.Operand).ParameterType
      ),
      Code.Ldfld or Code.Ldsfld when instruction.Operand is FieldReference field =>
        FloatWidener.IsSingle(FloatWidener.Instantiate(field.FieldType, field)),
      Code.Ldobj or Code.Ldelem_Any or Code.Unbox_Any => FloatWidener.IsSingle(
        (TypeReference) instruction.Operand
      ),
      Code.Call or Code.Callvirt when instruction.Operand is MethodReference method =>
        FloatWidener.IsSingle(FloatWidener.Instantiate(method.ReturnType, method)),
      Code.Calli => FloatWidener.IsSingle(((CallSite) instruction.Operand).ReturnType),
      _ => false
    };

  /// <summary>
  /// The type a member reference's generic parameter stands for at the call site, as Mono compiles
  /// each value-type instantiation on its own (<c>List&lt;float&gt;.get_Item</c> returns a float
  /// there): a class parameter from the declaring type's arguments, a method parameter from the
  /// method's.
  /// A parameter the site does not bind (inside a generic body) stays as it is.
  /// </summary>
  private static TypeReference Instantiate(TypeReference type, MemberReference member) {
    if (type is not GenericParameter parameter) {
      return type;
    }

    var arguments = parameter.Type is GenericParameterType.Type
      ? member.DeclaringType as IGenericInstance
      : member as IGenericInstance;

    return arguments?.GenericArguments.ElementAtOrDefault(parameter.Position) ?? type;
  }

  /// <summary>
  /// A modreq or a modopt, as <c>volatile</c> puts on a field, leaves a float a float for Mono.
  /// </summary>
  private static bool IsSingle(TypeReference type) =>
    type is IModifierType modified
      ? FloatWidener.IsSingle(modified.ElementType)
      : type.MetadataType is MetadataType.Single;

  /// <summary>
  /// Reads referenced assemblies into memory: the default resolver keeps them open, and Windows
  /// then refuses to overwrite one that a previous file referenced.
  /// </summary>
  private sealed class InMemoryResolver : DefaultAssemblyResolver {
    public override AssemblyDefinition Resolve(AssemblyNameReference name) =>
      this.Resolve(name, new ReaderParameters { AssemblyResolver = this, InMemory = true });
  }
}
