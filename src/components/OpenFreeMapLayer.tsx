import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { OFM_STYLES, type OfmStyleName } from "../lib/openFreeMap";

// Raster stand-in drawn the moment the map mounts. MapLibre is a ~1 MB
// download (≈290 KB gzipped) and needs WebGL; until it has loaded — or for
// good, on a PC/phone without WebGL or when the download fails — these
// light raster tiles are the basemap, so the markers never sit on a blank
// grey box waiting for it.
//
// Esri's Canvas basemaps: no key, ~5 KB tiles. (CARTO's free basemaps used to
// fill this role but now serve an "API KEY REQUIRED" image instead of a map.)
const ESRI_CANVAS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const ESRI_LIGHT = `${ESRI_CANVAS}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const RASTER_FALLBACK: Record<OfmStyleName, string> = {
  positron: ESRI_LIGHT,
  bright: ESRI_LIGHT,
  liberty: ESRI_LIGHT,
  dark: `${ESRI_CANVAS}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
};
const RASTER_ATTRIBUTION =
  'Esri, HERE, Garmin &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

// One shared download, started by whichever map mounts first.
let pluginPromise: Promise<unknown> | null = null;
function loadMaplibrePlugin() {
  pluginPromise ??= import("@maplibre/maplibre-gl-leaflet").catch((err) => {
    pluginPromise = null; // allow a retry on the next map visit
    throw err;
  });
  return pluginPromise;
}

/**
 * Base map layer backed by OpenFreeMap vector tiles, bridged into the
 * existing Leaflet map via @maplibre/maplibre-gl-leaflet so every other
 * Leaflet layer (GeoJSON boundaries, heatmap, markers) keeps working
 * unchanged. Renders nothing itself — it drives the map imperatively.
 *
 * Attribution is intentionally left to the plugin itself: it already adds
 * the correct OpenFreeMap/OSM credit to the map's attribution control once
 * the style finishes loading. Adding it manually here duplicated it.
 */
// Minimal shape of the underlying MapLibre map we touch — enough to hide
// label layers without pulling in the full maplibre-gl types.
interface GlMap {
  getStyle(): { layers?: { id: string; type: string }[] } | undefined;
  setLayoutProperty(id: string, name: string, value: unknown): void;
  isStyleLoaded?(): boolean;
  on(type: string, fn: () => void): void;
  off(type: string, fn: () => void): void;
}

// Basemap label layers that name *places* (towns, cities, districts). Hidden
// so neighbouring municipalities outside Davao don't clutter the map with
// confusing names — Davao's own barangay markers carry the labels that matter.
const PLACE_LABEL_RE = /place|city|town|village|hamlet|suburb|neighbourhood|state|country|continent|settlement/i;

export function OpenFreeMapLayer({
  styleName = "positron",
}: {
  styleName?: OfmStyleName;
}) {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    let detachGl: (() => void) | null = null;

    const raster = L.tileLayer(RASTER_FALLBACK[styleName], {
      attribution: RASTER_ATTRIBUTION,
      // Canvas tiles stop at 16; beyond that Leaflet scales the z16 ones up.
      maxNativeZoom: 16,
      maxZoom: 20,
    }).addTo(map);

    if (hasWebGL()) {
      loadMaplibrePlugin()
        .then(() => {
          if (cancelled) return;
          try {
            detachGl = attachVectorBasemap(map, styleName, () => {
              // The vector map has drawn its first frame — drop the stand-in.
              if (map.hasLayer(raster)) map.removeLayer(raster);
            });
          } catch (err) {
            // WebGL context refused (driver, too many maps open, …): the
            // raster basemap simply stays.
            console.warn("Vector basemap unavailable, using raster tiles:", err);
          }
        })
        .catch((err) => {
          console.warn("Vector basemap failed to load, using raster tiles:", err);
        });
    }

    return () => {
      cancelled = true;
      detachGl?.();
      if (map.hasLayer(raster)) map.removeLayer(raster);
    };
  }, [map, styleName]);

  return null;
}

/** Adds the MapLibre vector basemap; returns its cleanup. */
function attachVectorBasemap(
  map: L.Map,
  styleName: OfmStyleName,
  onFirstRender: () => void
): () => void {
  const layer = L.maplibreGL({
    style: OFM_STYLES[styleName],
    // Plugin-only option (not in MapLibre's typed MapOptions): render 30%
    // beyond the viewport instead of the default 10%, so a drag reveals map
    // that's already drawn rather than blank tiles catching up.
    //
    // Note: MapLibre's default fadeDuration (300ms) is kept on purpose — it's
    // what lets area/place labels fade smoothly across zoom levels. Forcing it
    // to 0 made those names blink out abruptly when zooming out.
    padding: 0.3,
  } as L.LeafletMaplibreGLOptions).addTo(map);
  const gl = (
    layer as unknown as { getMaplibreMap?: () => GlMap | null }
  ).getMaplibreMap?.();

  // Track layers we've already hidden so the handler stays cheap: `styledata`
  // fires repeatedly as vector tiles stream in during pan/zoom, and re-scanning
  // + rewriting every layer each time caused visible stutter. We only touch a
  // layer once, but still catch any label layers added later by the style.
  const hidden = new Set<string>();
  const hidePlaceLabels = () => {
    const style = gl?.getStyle();
    if (!style?.layers) return;
    for (const lyr of style.layers) {
      if (
        lyr.type === "symbol" &&
        !hidden.has(lyr.id) &&
        PLACE_LABEL_RE.test(lyr.id)
      ) {
        try {
          gl?.setLayoutProperty(lyr.id, "visibility", "none");
          hidden.add(lyr.id);
        } catch {
          // Some styles reject layout edits mid-load; the retry on the next
          // style event covers it.
        }
      }
    }
  };

  gl?.on("load", hidePlaceLabels);
  gl?.on("styledata", hidePlaceLabels);
  if (gl?.isStyleLoaded?.()) hidePlaceLabels();

  // `idle` = style and visible tiles fully drawn. Without a GL map handle
  // there is nothing to wait for, so swap straight away.
  const firstRender = () => {
    gl?.off("idle", firstRender);
    onFirstRender();
  };
  if (gl) gl.on("idle", firstRender);
  else onFirstRender();

  // Re-sync the basemap after a zoom that was cut short.
  //
  // The plugin raises a private `_zooming` flag on `zoomstart` and refuses
  // to reposition the basemap until `zoomend` lowers it. `flyTo` fires
  // `zoomstart` as it takes off — but when the flight is interrupted by
  // Leaflet's internal `_stop()` (most often the user grabbing the map
  // mid-flight; on a mouse, a "click" that moves 3px counts as a grab), no
  // `zoomend` ever follows. The flag sticks, the basemap stays where it was,
  // and the markers carry on without it: bubbles land out over the sea, by
  // exactly the distance dragged, until some later zoom happens to clear it.
  //
  // Every one of those interrupted paths still ends in a `moveend`. A normal
  // flight fires `zoomend` *before* its `moveend`, so by the time this runs
  // the flag is already down and it does nothing; it only acts when a
  // zoomend went missing. `_animatingZoom` keeps it out of the way of a
  // button or wheel zoom that's legitimately still running.
  const glLayer = layer as unknown as {
    _zooming?: boolean;
    _zoomEnd?: () => void;
  };
  const resyncAfterInterruptedZoom = () => {
    const animating = (map as unknown as { _animatingZoom?: boolean })
      ._animatingZoom;
    if (glLayer._zooming && !animating) glLayer._zoomEnd?.();
  };
  map.on("moveend", resyncAfterInterruptedZoom);

  return () => {
    map.off("moveend", resyncAfterInterruptedZoom);
    gl?.off("load", hidePlaceLabels);
    gl?.off("styledata", hidePlaceLabels);
    gl?.off("idle", firstRender);
    map.removeLayer(layer);
  };
}
