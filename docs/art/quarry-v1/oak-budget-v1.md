# Oak runtime budget v1

The runtime tree variants reuse the approved Tripo oak source and use Blender
Decimate only for geometry LODs. The source remains available for a later
replacement asset; it is not loaded by the game.

| Runtime asset | Scene role | Triangle budget | Actual triangles | Packed download |
| --- | --- | ---: | ---: | ---: |
| `oak-near` | arrival-side trees | 12,000 max | 9,999 | 567,431 bytes |
| `oak-mid` | rear ledge trees | 5,000 max | 3,999 | 481,079 bytes |
| `oak-far` | distant rim trees | 1,500 max | 999 | 426,828 bytes |

All variants use the same 512×512 base-color, 256×256 normal and 128×128 ORM
KTX2 mip chains. The layout assigns the six placements explicitly to these
roles, so ordinary scenery remains resident and is not distance-unloaded.
The three variants total 14,997 unique triangles; the six placed trees use
two instances of each role and therefore contribute about 29,994 triangles.
