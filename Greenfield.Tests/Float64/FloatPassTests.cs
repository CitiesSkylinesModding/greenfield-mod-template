using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using Colossal.Logging;
using Game.Simulation;
using Unity.Mathematics;
using UnityEngine;
using Xunit;

namespace Greenfield.Tests.Float64;

/// <summary>
/// The two passes `mise test:cs` runs: single precision, as CoreCLR and Burst compute floats, then
/// double precision, as the game's Mono does outside Burst (see FloatWidener.cs).
/// </summary>
public sealed class FloatPassTests {
  #if FLOAT64
  private const bool IsFloat64Pass = true;
  #else
  private const bool IsFloat64Pass = false;
  #endif

  /// <summary>
  /// 2^24, the first float whose successor is not representable: adding 1 rounds it away in single
  /// precision only.
  /// </summary>
  private const float Large = 16777216f;

  /// <summary>
  /// What <c>Large + 1 - Large</c> leaves: 1 in double precision, 0 in single precision.
  /// </summary>
  private const float ExcessInPass = FloatPassTests.IsFloat64Pass ? 1f : 0f;

  /// <seealso cref="FrameworkEnumConstant_SurvivesTheWidening"/>
  private const BindingFlags FrameworkFlags = BindingFlags.NonPublic | BindingFlags.Instance;

  // IDE0044 asks for readonly, which a volatile field cannot be (CS0678).
  #pragma warning disable IDE0044
  private static volatile float volatileLarge = FloatPassTests.Large;

  private static volatile float volatileOne = 1f;
  #pragma warning restore IDE0044

  [Fact]
  public void Arithmetic_RunsInThePassPrecision() =>
    Assert.Equal(FloatPassTests.ExcessInPass, FloatPassTests.Excess(FloatPassTests.Large, 1f));

  /// <summary>
  /// The in-game check that the game's Mono computes floats as the float64 pass does, run
  /// off-engine: <c>math.dot</c> sums on the stack, in double precision, and <c>math.mul</c> sums
  /// through <c>float3</c> fields, narrowed to float at each store.
  /// From the unity eval, the game returns 1 and 0 (Unity 2022.3.71f1), as upstream Mono 6.14 does
  /// with <c>-O=-float32</c>.
  /// </summary>
  [Fact]
  public void GameMath_RunsInThePassPrecision() {
    var dot = math.dot(new float3(FloatPassTests.Large, 1f, -FloatPassTests.Large), new float3(1f));

    var mul = math.mul(
      new float3x3(
        new float3(FloatPassTests.Large, 0f, 0f),
        new float3(1f, 0f, 0f),
        new float3(-FloatPassTests.Large, 0f, 0f)
      ),
      new float3(1f)
    );

    Assert.Equal((FloatPassTests.ExcessInPass, 0f), (dot, mul.x));
  }

  /// <summary>
  /// Mono compiles each value-type instantiation of a generic on its own, so a float a generic
  /// returns is held as a double like any other.
  /// </summary>
  [Fact]
  public void GenericReturns_RunInThePassPrecision() {
    var values = new List<float> {
      FloatPassTests.Large,
      1f
    };

    Assert.Equal(FloatPassTests.ExcessInPass, FloatPassTests.ExcessOf(values));
  }

  /// <summary>
  /// A <c>volatile float</c> field is typed <c>float modreq(IsVolatile)</c>, which Mono loads as
  /// any other float.
  /// Both operands are volatile: a widened one would widen the other.
  /// </summary>
  [Fact]
  public void VolatileFields_RunInThePassPrecision() =>
    Assert.Equal(
      FloatPassTests.ExcessInPass,
      FloatPassTests.volatileLarge + FloatPassTests.volatileOne - FloatPassTests.volatileLarge
    );

  /// <summary>
  /// The widened test assembly keeps its symbols: a stack trace names the source file.
  /// </summary>
  [Fact]
  public void Symbols_AreFoundInBothPasses() =>
    Assert.EndsWith(
      $"{nameof(FloatPassTests)}.cs",
      new StackTrace(true).GetFrame(0)?.GetFileName() ?? ""
    );

  /// <summary>
  /// The test, mod, and game assemblies are widened, UnityEngine.CoreModule included (before the
  /// native-call shim's rewrite).
  /// </summary>
  [Theory]
  [InlineData(typeof(FloatPassTests))]
  [InlineData(typeof(Mod))]
  [InlineData(typeof(SimulationSystem))]
  [InlineData(typeof(ILog))]
  [InlineData(typeof(float3))]
  [InlineData(typeof(Vector3))]
  public void Assemblies_AreWidenedInTheFloat64PassOnly(Type typeInAssembly) =>
    Assert.Equal(
      FloatPassTests.IsFloat64Pass,
      typeInAssembly.Assembly.GetType("<FloatWidened>") is not null
    );

  /// <summary>
  /// A bug of the kind only the game shows: a run's end read back from memory (narrowed to float)
  /// compared with the same product computed again (a double under the game's Mono).
  /// The float64 pass finds the zero-length runs it leaves, the float32 pass does not.
  /// </summary>
  [Fact]
  public void ReadBackComparisonBug_ShowsInTheFloat64PassOnly() =>
    Assert.Equal(
      FloatPassTests.IsFloat64Pass,
      Enumerable
        .Range(1, 199)
        .Any(static last => FloatPassTests.LeavesZeroLengthRun(last, 0.7f, 0f))
    );

  /// <summary>
  /// The bug's fix, a tolerance on the comparison, holds in both passes.
  /// </summary>
  [Fact]
  public void ReadBackComparisonFix_HoldsInBothPasses() =>
    Assert.DoesNotContain(
      Enumerable.Range(1, 199),
      static last => FloatPassTests.LeavesZeroLengthRun(last, 0.7f, 0.7f * 0.01f)
    );

  /// <summary>
  /// A constant field of a .NET enum the game's System.Runtime facade does not forward, whose type
  /// the widener resolves to write the assembly back.
  /// </summary>
  [Fact]
  public void FrameworkEnumConstant_SurvivesTheWidening() =>
    Assert.NotEqual(default, FloatPassTests.FrameworkFlags);

  [MethodImpl(MethodImplOptions.NoInlining)]
  private static float Excess(float a, float b) => a + b - a;

  [MethodImpl(MethodImplOptions.NoInlining)]
  private static float ExcessOf(List<float> values) => values[0] + values[1] - values[0];

  [MethodImpl(MethodImplOptions.NoInlining)]
  private static bool LeavesZeroLengthRun(int last, float step, float tolerance) {
    var ends = new float[1];

    ends[0] = last * step;

    return (last * step) - ends[0] > tolerance;
  }
}
