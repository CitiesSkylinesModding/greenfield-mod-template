using System.Linq;
using Colossal.Reflection;
using Colossal.TestFramework;

namespace Greenfield.Scenarios;

/// <summary>
/// Adds the mod's in-game test scenarios to the game's test framework, in Debug builds only (the
/// csproj compiles this folder in Debug alone).
/// The game collects its scenarios before mods load, so the mod adds its own to the same
/// dictionary.
/// <c>scripts/test-game.ts</c> tells a Debug build by this class's name in the assembly: a rename
/// renames the string there too.
/// </summary>
internal static class ScenarioRegistry {
  /// <summary>
  /// The category every scenario of the mod carries.
  /// The game runs, five seconds after its first main menu, every scenario whose category bits all
  /// lie in its <c>--categoryFilter=</c> option, which also takes a number: a bit no category of
  /// the game's uses leaves the game's scenarios and other mods' <see cref="Category.QA"/> ones out
  /// of the run.
  /// <c>scripts/test-game.ts</c> passes the same number.
  /// </summary>
  internal const Category ScenarioCategory = (Category) (1 << 20);

  internal static void Register() {
    var scenarios = TestScenarioSystem.instance.scenarios;

    var scenarioTypes = typeof(ScenarioRegistry).Assembly
      .GetTypes()
      .Where(static type => typeof(TestScenario).IsAssignableFrom(type) && !type.IsAbstract);

    foreach (var type in scenarioTypes) {
      if (!type.TryGetAttribute(out TestDescriptorAttribute descriptor)) {
        continue;
      }

      scenarios[descriptor.description] = new TestScenarioSystem.Scenario {
        category = descriptor.category,
        testPhase = descriptor.testPhase,
        test = type,
        disabled = descriptor.disabled
      };

      Mod.Log.Verbose($"{nameof(ScenarioRegistry)}: Added \"{descriptor.description}\".");
    }
  }
}
