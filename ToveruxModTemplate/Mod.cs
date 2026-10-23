using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Game;
using Game.Modding;
using Game.SceneFlow;

namespace ToveruxModTemplate;

public class Mod : IMod {
  public static ILog log = LogManager.GetLogger($"{nameof(ToveruxModTemplate)}.{nameof(Mod)}")
    .SetShowsErrorsInUI(false);

  private Setting? m_Setting;

  public void OnLoad(UpdateSystem updateSystem) {
    Mod.log.Info(nameof(Mod.OnLoad));

    if (GameManager.instance.modManager.TryGetExecutableAsset(this, out var asset)) {
      Mod.log.Info($"Current mod asset at {asset.path}");
    }

    this.m_Setting = new Setting(this);
    this.m_Setting.RegisterInOptionsUI();
    GameManager.instance.localizationManager.AddSource("en-US", new LocaleEN(this.m_Setting));

    AssetDatabase.global.LoadSettings(
      nameof(ToveruxModTemplate),
      this.m_Setting,
      new Setting(this)
    );
  }

  public void OnDispose() {
    Mod.log.Info(nameof(Mod.OnDispose));

    this.m_Setting?.UnregisterInOptionsUI();
    this.m_Setting = null;
  }
}
