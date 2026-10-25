using Greenfield.Systems;
using Unity.Burst.Intrinsics;
using Xunit;

namespace Greenfield.Tests.Systems;

public sealed class EntityCounterSystemTests {
  [Fact]
  public void CountChunkEntities_WithoutEnabledMask_CountsTheWholeChunk() {
    // A mask the job must ignore, as the chunk passes it without any enableable filter.
    var mask = new v128(ulong.MaxValue, 0UL);

    Assert.Equal(42, EntityCounterSystem.CountChunkEntities(42, false, mask));
  }

  [Fact]
  public void CountChunkEntities_WithEnabledMask_CountsTheEnabledEntitiesOfBothHalves() {
    // Entities 0, 2, and 63 in the first half, 64 and 127 in the second.
    var mask = new v128(0b101UL | (1UL << 63), 1UL | (1UL << 63));

    Assert.Equal(5, EntityCounterSystem.CountChunkEntities(128, true, mask));
  }
}
