# Spatial Calculation Demo

<img width="1265" height="623" alt="image" src="https://github.com/user-attachments/assets/7afb2869-7361-4ee0-8648-87d07a3d9993" />


React + [That Open](https://thatopen.com/) BIM viewer. Two side-by-side models: a valid house IFC, and a staged invalid copy of the same house.

**Proof of concept, not automated compliance.** Findings come from a small offline script on known elements. The invalid 3D view is drawn to match those numbers. The point is IFC in → quantities out → isolate a failing piece in WebGL, not a live code engine.

## What you should see

Two cards:

| | Door | Window | Room |
| --- | --- | --- | --- |
| **Valid** (green) | 1010 mm | 1010 mm | 30.55 m² |
| **Invalid** (red) | 4200 mm | 4800 mm | 6.79 m² |
| **Limit** | max 1200 mm | max 1500 mm | min 9.8 m² |

Each finding shows measured vs the limit, how far over/under it is, and a small bar (fill = measured, tick = limit).

- Click a finding to frame that piece. Invalid openings are a red see-through cut; the doorless interior wall is slid inward. Pass pieces are tinted green.
- Click in 3D for a blue highlight plus name and size.

Both viewers load **one** file: `public/models/BasicHouse.ifc`. The invalid IFC is only for `check-ifc`. The mesh in the IFC is not remeshed; attributes change, then the invalid viewer overlays the fail.

UI labels are English. The source IFC is a Swedish Revit export.
