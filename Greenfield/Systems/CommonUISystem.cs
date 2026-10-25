using System;
using Colossal.Localization;
using Colossal.UI.Binding;
using Game.SceneFlow;
using Game.Settings;
using Game.UI;
using Game.UI.Menu;
using Greenfield.Logging;
using Greenfield.Reflection;
using Greenfield.Utils;
using UnityEngine;

namespace Greenfield.Systems;

/// <summary>
/// UI System providing utilities used by various features of the mod: the active locale and the
/// settings as value bindings, opening the mod's settings or a web page, and showing JavaScript
/// errors in the game's error dialog.
/// </summary>
internal sealed partial class CommonUISystem : UISystemBase {
  private const string BindingGroup = "greenfield.common";

  private readonly LocalizationManager localizationManager =
    GameManager.instance.localizationManager;

  // Both bindings are created in OnCreate, which the game runs before any other member: hence
  // mutable, and null! until then.
  private GetterValueBinding<string> localeBinding = null!;

  private GetterValueBinding<Settings> settingsBinding = null!;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      // No need to OnUpdate as there are no bindings that require it, they are manually updated
      // when needed.
      this.Enabled = false;

      this.localeBinding = new GetterValueBinding<string>(
        CommonUISystem.BindingGroup,
        "locale",
        () => this.localizationManager.activeLocaleId
      );

      // The settings object is updated in place, so the default comparer would see it unchanged and
      // skip every update.
      this.settingsBinding = new GetterValueBinding<Settings>(
        CommonUISystem.BindingGroup,
        "settings",
        static () => Mod.Settings,
        comparer: new AlwaysFalseEqualityComparer<Settings>()
      );

      this.AddBinding(this.localeBinding);
      this.AddBinding(this.settingsBinding);

      this.AddBinding(
        new TriggerBinding<string>(
          CommonUISystem.BindingGroup,
          "openModSettings",
          this.OpenModSettings
        )
      );

      this.AddBinding(
        new TriggerBinding<string>(
          CommonUISystem.BindingGroup,
          "openWebPage",
          Application.OpenURL
        )
      );

      this.AddBinding(
        new TriggerBinding<bool, string>(
          CommonUISystem.BindingGroup,
          "logJavaScriptError",
          CommonUISystem.LogJavaScriptError
        )
      );

      this.localizationManager.onActiveDictionaryChanged += this.OnActiveDictionaryChanged;

      Mod.Settings.onSettingsApplied += this.OnSettingsApplied;
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  protected override void OnDestroy() {
    base.OnDestroy();

    this.localizationManager.onActiveDictionaryChanged -= this.OnActiveDictionaryChanged;

    Mod.Settings.onSettingsApplied -= this.OnSettingsApplied;
  }

  /// <summary>
  /// Shows an error sent from JavaScript in the game's error dialog, and logs it.
  /// </summary>
  private static void LogJavaScriptError(bool isFatal, string error) {
    ErrorDialogManagerAccessor.Instance?.ShowError(
      new ErrorDialog {
        localizedMessage = ModLog.PlayerMessage(isFatal, static key => key.Translate()),
        errorDetails = error
      }
    );

    Mod.Log.ErrorSilent(error);
  }

  private void OnActiveDictionaryChanged() => this.localeBinding.Update();

  private void OnSettingsApplied(Setting setting) => this.settingsBinding.Update();

  /// <summary>
  /// Opens the mod settings page at the specified tab, e.g. <c>General</c>, the tab of a
  /// one-argument <see cref="SettingsUISectionAttribute"/>.
  /// </summary>
  private void OpenModSettings(string tab) {
    var optionsUISystem = this.World.GetOrCreateSystemManaged<OptionsUISystem>();

    // OpenPage matches tab ids, not groups: an unknown id falls back to the first tab (decompile,
    // OptionsUISystem.SelectSection).
    optionsUISystem.OpenPage(Mod.Settings.id, $"{Mod.Settings.id}.{tab}", false);
  }
}
