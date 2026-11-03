using System;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Game;
using Game.Modding;
using Greenfield.Logging;
using Greenfield.Systems;
using Greenfield.Utils;
using JetBrains.Annotations;
#if DEBUG
using Greenfield.Reflection;
using Greenfield.Scenarios;
#endif

namespace Greenfield;

[UsedImplicitly]
public sealed class Mod : IMod {
  // Mutable, as OnLoad sets both, not a constructor.
  private static Mod? instanceValue;

  private Settings? settingsValue;

  /// <summary>
  /// A little more than a singleton, it is set only when the mod has successfully finished its
  /// <see cref="OnLoad"/>.
  /// </summary>
  /// <exception cref="NullReferenceException">
  /// If the mod has not been loaded yet.
  /// </exception>
  // ReSharper disable once UnusedMember.Global
  public static Mod Instance =>
    Mod.instanceValue ??
    throw new NullReferenceException($"Mod {nameof(Mod.OnLoad)}() was not called yet.");

  /// <exception cref="NullReferenceException">
  /// If the mod settings have not been loaded yet.
  /// </exception>
  public static Settings Settings =>
    Mod.instanceValue?.settingsValue ??
    throw new NullReferenceException($"Mod {nameof(Mod.OnLoad)}() was not called yet.");

  internal static IModLog Log { get; } = new ModLog(
    LogManager.GetLogger(nameof(Greenfield))
      .SetShowsErrorsInUI(true)
      .SetEffectiveness(Level.All),
    static key => key.Translate()
  );

  public void OnLoad(UpdateSystem updateSystem) {
    try {
      // Set up locales.
      LocaleLoader.Setup();

      #if DEBUG
      // In debug mode, eagerly check reflection hacks are working, once locales are loaded so a
      // failure reports translated text.
      ErrorDialogManagerAccessor.Init();
      #endif

      // Register settings UI and load settings.
      this.settingsValue = new Settings(this);
      var defaultSettings = this.settingsValue.Clone();

      this.settingsValue.RegisterInOptionsUI();
      this.settingsValue.RegisterKeyBindings();

      AssetDatabase.global.LoadSettings(
        nameof(Greenfield),
        this.settingsValue,
        defaultSettings
      );

      // The settings file can hold an explicit null over a string the defaults always set, and the
      // game's loader applies it verbatim, which breaks the whole options page.
      // Repairing the in-memory instance is enough, as the game dumps ModSetting properties to file
      // on close, so no ApplyAndSave() here.
      this.settingsValue.RestoreNullStrings(defaultSettings);

      // Set singleton instance only when OnLoad is likely to complete.
      Mod.instanceValue = this;

      // Initialize subsystems.
      updateSystem.UpdateAt<CommonUISystem>(SystemUpdatePhase.UIUpdate);
      updateSystem.UpdateAt<EntityCounterSystem>(SystemUpdatePhase.ModificationEnd);
      updateSystem.UpdateAt<EntityCounterUISystem>(SystemUpdatePhase.UIUpdate);

      #if DEBUG
      // Make the in-game test scenarios available to the game's test framework.
      ScenarioRegistry.Register();
      #endif

      Mod.Log.Verbose($"{nameof(Mod)}: {nameof(this.OnLoad)} complete.");
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  public void OnDispose() {
    // Nothing particular to do here.
    // There is no need to clean up things like localization, event listeners, etc., as you can't
    // just unload and reload a mod, disposing only happens when quitting the game, so here we only
    // need to clean up things that are observable after the process exited.
  }
}
