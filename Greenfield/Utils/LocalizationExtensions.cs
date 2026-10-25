using Colossal.Localization;
using Game.SceneFlow;

namespace Greenfield.Utils;

internal static class LocalizationExtensions {
  private static LocalizationDictionary LocalizationDictionary =>
    GameManager.instance.localizationManager.activeDictionary;

  extension(string key) {
    /// <summary>
    /// One-off translation from a key.
    /// If the key is not found in the dictionary and a fallback is not provided, the key is
    /// returned as is.
    /// </summary>
    internal string Translate(string? fallback = null) =>
      LocalizationExtensions.LocalizationDictionary
        .TryGetValue(key, out var value)
        ? value
        : fallback ?? key;
  }
}
