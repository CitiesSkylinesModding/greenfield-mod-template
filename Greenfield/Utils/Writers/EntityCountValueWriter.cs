using Colossal.UI.Binding;
using Greenfield.Systems;

namespace Greenfield.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="EntityCounterUISystem.EntityCount"/>.
/// Its shape never varies: a value whose properties vary encodes the variant in its type name,
/// because cohtml caches an object's shape by that name and crashes the game when a later write
/// under it carries other properties.
/// </summary>
internal sealed class EntityCountValueWriter : IWriter<EntityCounterUISystem.EntityCount> {
  public void Write(IJsonWriter writer, EntityCounterUISystem.EntityCount value) {
    writer.TypeBegin(typeof(EntityCounterUISystem.EntityCount).FullName);

    writer.PropertyName("count");
    writer.Write(value.Count);

    writer.PropertyName("year");
    writer.Write(value.Year);

    writer.PropertyName("month");
    writer.Write(value.Month);

    writer.TypeEnd();
  }
}
