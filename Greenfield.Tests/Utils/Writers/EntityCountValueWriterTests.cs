using Greenfield.Systems;
using Greenfield.Utils.Writers;
using Xunit;

namespace Greenfield.Tests.Utils.Writers;

public sealed class EntityCountValueWriterTests {
  /// <summary>
  /// The UI reads these names, see `EntityCount` in `UI/src/utils/bindings/entity-counter.ts`.
  /// </summary>
  [Fact]
  public void Write_WritesTheShapeTheUIReads() {
    var jsonWriter = new ShapeRecordingJsonWriter();

    new EntityCountValueWriter().Write(jsonWriter, new EntityCounterUISystem.EntityCount(1, 2, 3));

    var shape = Assert.Single(jsonWriter.Shapes);

    Assert.Equal(typeof(EntityCounterUISystem.EntityCount).FullName, shape.Key);
    Assert.Equal(["count,year,month"], shape.Value);
  }
}
