import { useEffect, useRef } from "react";
import * as fabricLayerUtils from "../../utils/fabricLayerUtils";

export default function useCanvasLayerRefs({
  layers,
  activeLayerId,
  getSortedLayers,
  canvasRef,
  setCanvasRevision,
  canvasRevision,
}) {
  const activeLayerIdRef = useRef(activeLayerId);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const getSortedLayersRef = useRef(getSortedLayers);
  useEffect(() => {
    getSortedLayersRef.current = getSortedLayers;
  }, [getSortedLayers]);

  useEffect(() => {
    if (canvasRef.current) {
      const sortedLayers = getSortedLayers();
      fabricLayerUtils.reorderObjectsByLayers(
        canvasRef.current,
        sortedLayers
      );
    }
  }, [layers, canvasRevision, canvasRef, getSortedLayers]);

  return {
    activeLayerIdRef,
    layersRef,
    getSortedLayersRef,
  };
}
