using System;
using System.Collections.Generic;
using Colossal;
using Colossal.IO.AssetDatabase;
using Game.Modding;
using Game.Settings;
using Game.UI;
using Game.UI.Widgets;

namespace ToveruxModTemplate;

[FileLocation(nameof(ToveruxModTemplate))]
[SettingsUIGroupOrder(
  Setting.kButtonGroup,
  Setting.kToggleGroup,
  Setting.kSliderGroup,
  Setting.kDropdownGroup
)]
[SettingsUIShowGroupName(
  Setting.kButtonGroup,
  Setting.kToggleGroup,
  Setting.kSliderGroup,
  Setting.kDropdownGroup
)]
public class Setting : ModSetting {
  public const string kSection = "Main";

  public const string kButtonGroup = "Button";

  public const string kToggleGroup = "Toggle";

  public const string kSliderGroup = "Slider";

  public const string kDropdownGroup = "Dropdown";

  public Setting(IMod mod) : base(mod) {
  }

  [SettingsUISection(Setting.kSection, Setting.kButtonGroup)]
  public bool Button { set { Mod.log.Info("Button clicked"); } }

  [SettingsUIButton]
  [SettingsUIConfirmation]
  [SettingsUISection(Setting.kSection, Setting.kButtonGroup)]
  public bool ButtonWithConfirmation { set { Mod.log.Info("ButtonWithConfirmation clicked"); } }

  [SettingsUISection(Setting.kSection, Setting.kToggleGroup)]
  public bool Toggle { get; set; }

  [SettingsUISlider(min = 0, max = 100, step = 1, scalarMultiplier = 1, unit = Unit.kDataMegabytes)]
  [SettingsUISection(Setting.kSection, Setting.kSliderGroup)]
  public int IntSlider { get; set; }

  [SettingsUIDropdown(typeof(Setting), nameof(Setting.GetIntDropdownItems))]
  [SettingsUISection(Setting.kSection, Setting.kDropdownGroup)]
  public int IntDropdown { get; set; }

  [SettingsUISection(Setting.kSection, Setting.kDropdownGroup)]
  public SomeEnum EnumDropdown { get; set; } = SomeEnum.Value1;

  public DropdownItem<int>[] GetIntDropdownItems() {
    var items = new List<DropdownItem<int>>();

    for (var i = 0; i < 3; i += 1) {
      items.Add(
        new DropdownItem<int> {
          value = i,
          displayName = i.ToString()
        }
      );
    }

    return items.ToArray();
  }

  public override void SetDefaults() {
    throw new NotImplementedException();
  }

  public enum SomeEnum {
    Value1,

    Value2,

    Value3
  }
}

public class LocaleEN : IDictionarySource {
  private readonly Setting m_Setting;

  public LocaleEN(Setting setting) {
    this.m_Setting = setting;
  }

  public IEnumerable<KeyValuePair<string, string>> ReadEntries(
    IList<IDictionaryEntryError> errors,
    Dictionary<string, int> indexCounts
  ) {
    return new Dictionary<string, string> {
      { this.m_Setting.GetSettingsLocaleID(), "ToveruxModTemplate" },
      { this.m_Setting.GetOptionTabLocaleID(Setting.kSection), "Main" },

      { this.m_Setting.GetOptionGroupLocaleID(Setting.kButtonGroup), "Buttons" },
      { this.m_Setting.GetOptionGroupLocaleID(Setting.kToggleGroup), "Toggle" },
      { this.m_Setting.GetOptionGroupLocaleID(Setting.kSliderGroup), "Sliders" },
      { this.m_Setting.GetOptionGroupLocaleID(Setting.kDropdownGroup), "Dropdowns" },

      { this.m_Setting.GetOptionLabelLocaleID(nameof(Setting.Button)), "Button" }, {
        this.m_Setting.GetOptionDescLocaleID(nameof(Setting.Button)),
        $"Simple single button. It should be bool property with only setter or use [{nameof(SettingsUIButtonAttribute)}] to make button from bool property with setter and getter"
      }, {
        this.m_Setting.GetOptionLabelLocaleID(nameof(Setting.ButtonWithConfirmation)),
        "Button with confirmation"
      }, {
        this.m_Setting.GetOptionDescLocaleID(nameof(Setting.ButtonWithConfirmation)),
        $"Button can show confirmation message. Use [{nameof(SettingsUIConfirmationAttribute)}]"
      }, {
        this.m_Setting.GetOptionWarningLocaleID(nameof(Setting.ButtonWithConfirmation)),
        "is it confirmation text which you want to show here?"
      },

      { this.m_Setting.GetOptionLabelLocaleID(nameof(Setting.Toggle)), "Toggle" }, {
        this.m_Setting.GetOptionDescLocaleID(nameof(Setting.Toggle)),
        "Use bool property with setter and getter to get toggable option"
      },

      { this.m_Setting.GetOptionLabelLocaleID(nameof(Setting.IntSlider)), "Int slider" }, {
        this.m_Setting.GetOptionDescLocaleID(nameof(Setting.IntSlider)),
        $"Use int property with getter and setter and [{nameof(SettingsUISliderAttribute)}] to get int slider"
      },

      { this.m_Setting.GetOptionLabelLocaleID(nameof(Setting.IntDropdown)), "Int dropdown" }, {
        this.m_Setting.GetOptionDescLocaleID(nameof(Setting.IntDropdown)),
        $"Use int property with getter and setter and [{nameof(SettingsUIDropdownAttribute)}(typeof(SomeType), nameof(SomeMethod))] to get int dropdown: Method must be static or instance of your setting class with 0 parameters and returns {typeof(DropdownItem<int>).Name}"
      }, {
        this.m_Setting.GetOptionLabelLocaleID(nameof(Setting.EnumDropdown)), "Simple enum dropdown"
      }, {
        this.m_Setting.GetOptionDescLocaleID(nameof(Setting.EnumDropdown)),
        "Use any enum property with getter and setter to get enum dropdown"
      },

      { this.m_Setting.GetEnumValueLocaleID(Setting.SomeEnum.Value1), "Value 1" },
      { this.m_Setting.GetEnumValueLocaleID(Setting.SomeEnum.Value2), "Value 2" },
      { this.m_Setting.GetEnumValueLocaleID(Setting.SomeEnum.Value3), "Value 3" }
    };
  }

  public void Unload() {
  }
}
