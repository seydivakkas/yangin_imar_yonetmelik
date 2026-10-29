import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SidebarTabs } from './components/SidebarTabs';
import { ThreeScene } from './components/ThreeScene';
import { TimelineControls } from './components/TimelineControls';
import { DetailsDrawer } from './components/DetailsDrawer';

// Panels
import { OverviewPanel } from './components/Panels/OverviewPanel';
import { CadPolygonPanel } from './components/Panels/CadPolygonPanel';
import { SpatialRagPanel } from './components/Panels/SpatialRagPanel';
import { SpminerPanel } from './components/Panels/SpminerPanel';
import { FireAuditPanel } from './components/Panels/FireAuditPanel';
import { FireChecklistPanel } from './components/Panels/FireChecklistPanel';
import { BasementAuditPanel } from './components/Panels/BasementAuditPanel';
import { EvacuationPanel } from './components/Panels/EvacuationPanel';
import { OptimizationPanel } from './components/Panels/OptimizationPanel';
import { DxfExportPanel } from './components/Panels/DxfExportPanel';
import { RegulatoryReportPanel } from './components/Panels/RegulatoryReportPanel';
import { RegulatoryLibraryPanel } from './components/Panels/RegulatoryLibraryPanel';
import { CvImagePanel } from './components/Panels/CvImagePanel';
import { RegulatoryArticleModal } from './components/RegulatoryArticleModal';

import {
  ActiveTab,
  CameraPreset,
  DiagramYonetmelikPipelineOutput,
  WallHeightMode,
} from './types/pipeline';

export const App: React.FC = () => {
  const [pipelineData, setPipelineData] = useState<DiagramYonetmelikPipelineOutput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<'sample' | 'high_rise' | 'compliant_8' | 'upload' | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);

  // 3D Scene & Simulation State
  const [activeFloor, setActiveFloor] = useState<'all' | number>('all');
  const [explodedZ, setExplodedZ] = useState<number>(1.0);
  const [wallHeightMode, setWallHeightMode] = useState<WallHeightMode>('cut');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [simulationTime, setSimulationTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  // Yüklenen paftadan dinamik olarak çıkarılan kat seviyeleri
  const availableFloors = useMemo<number[]>(() => {
    const floorSet = new Set<number>();
    if (pipelineData?.nodes && pipelineData.nodes.length > 0) {
      pipelineData.nodes.forEach((n: any) => {
        if (typeof n.floor_level === 'number') {
          floorSet.add(n.floor_level);
        }
      });
    }
    if (pipelineData?.violations && pipelineData.violations.length > 0) {
      pipelineData.violations.forEach((v: any) => {
        if (typeof v.floor_level === 'number') {
          floorSet.add(v.floor_level);
        }
      });
    }
    if (floorSet.size > 0) {
      return Array.from(floorSet).sort((a, b) => b - a);
    }
    const total = pipelineData?.metadata?.total_floors || 2;
    if (total <= 2) return [0, -1];
    const topFloor = Math.max(1, total - 2);
    const generated: number[] = [];
    for (let f = topFloor; f >= -1; f--) {
      generated.push(f);
    }
    return generated;
  }, [pipelineData]);

  // Pafta değişiminde seçili kat o paftada yoksa 'all' seviyesine sıfırla
  useEffect(() => {
    if (activeFloor !== 'all' && !availableFloors.includes(activeFloor)) {
      setActiveFloor('all');
    }
  }, [availableFloors, activeFloor]);


  // Feature Toggles
  const [showSmoke, setShowSmoke] = useState<boolean>(true);
  const [showRAGOverlay, setShowRAGOverlay] = useState<boolean>(false);
  const [showBottlenecks, setShowBottlenecks] = useState<boolean>(true);
  const [showBIMArchitecture, setShowBIMArchitecture] = useState<boolean>(true);
  const [showDoorArcs, setShowDoorArcs] = useState<boolean>(false);
  const [cadDiffMode, setCadDiffMode] = useState<'before' | 'after' | 'both'>('before');

  // Object Inspector
  const [selectedElement, setSelectedElement] = useState<{
    id: string;
    type: 'room' | 'door' | 'wall' | 'arc' | 'violation' | 'checklist_item';
    details: any;
  } | null>(null);

  // Mevzuat Madde İnceleme Modalı State'i
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Sağ Panel Boyutlandırma (Resizable Splitter: 280px - 650px)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1440) return 400;
    return 360;
  });
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Resize Splitter Event Listeners
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Fare imlecinin pencerenin sağ kenarına olan mesafesi
      const maxAllowed = Math.min(680, window.innerWidth - 320);
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= maxAllowed) {
        setPanelWidth(newWidth);
      } else if (newWidth < 280) {
        setPanelWidth(280);
      } else if (newWidth > maxAllowed) {
        setPanelWidth(maxAllowed);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Simulation Clock Tick
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      const maxT = pipelineData?.evacuation?.total_evacuation_time_s
        || pipelineData?.evacuation?.baseline_time_sec
        || 180;
      const limitT = Math.max(180, Math.ceil(maxT));
      interval = setInterval(() => {
        setSimulationTime((prev) => {
          const next = prev + 0.5 * playbackSpeed;
          if (next >= limitT) {
            setIsPlaying(false);
            return limitT;
          }
          return Number(next.toFixed(1));
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, pipelineData]);

  // Load Initial / Sample Data on mount
  const runSampleAudit = async () => {
    setIsLoading(true);
    setLoadingAction('sample');
    try {
      const res = await fetch('/api/audit/sample', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setPipelineData(json);
        setActiveFloor('all');
      } else {
        console.warn('Backend returned error or not running; loading client fallback.');
      }
    } catch (err) {
      console.warn('Using client mock pipeline data:', err);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  // Load 12-Story High-Rise Audit
  const runHighRiseAudit = async () => {
    setIsLoading(true);
    setLoadingAction('high_rise');
    try {
      const res = await fetch('/api/audit/high-rise-12', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setPipelineData(json);
        setActiveFloor('all');
        setActiveTab('overview');
      } else {
        console.warn('Backend high-rise endpoint returned error');
      }
    } catch (err) {
      console.error('Failed to run 12-story high rise audit:', err);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  // Load 8-Story Fully Compliant Pafta (312 İhlali Sıfırlayan Kusursuz Model)
  const runCompliant8StoryAudit = async () => {
    setIsLoading(true);
    setLoadingAction('compliant_8');
    try {
      const res = await fetch('/api/audit/compliant-8-story', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setPipelineData(json);
        setActiveFloor('all');
        setActiveTab('overview');
      } else {
        console.warn('Backend compliant 8-story endpoint returned error');
      }
    } catch (err) {
      console.error('Failed to run compliant 8-story audit:', err);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  useEffect(() => {
    runSampleAudit();
  }, []);

  // Upload Handlers
  const handleUploadDXF = async (file: File) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/audit/dxf', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const json = await res.json();
        setPipelineData(json);
      }
    } catch (err) {
      console.error('DXF upload failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/audit/image', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const json = await res.json();
        setPipelineData(json);
        setActiveTab('cv_image');
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadDXF = () => {
    const filename = pipelineData?.dxf_export_info?.filename || 'denetlenmis_diagram_yonetmelik.dxf';
    const link = document.createElement('a');
    link.href = '/api/download/annotated-dxf';
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyOptimization = () => {
    setCadDiffMode('after');
    setActiveTab('optimization');
    setSimulationTime(0);
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070A11] text-gray-100 overflow-hidden font-sans">
      {/* Top Header */}
      <Header
        data={pipelineData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLoading={isLoading}
        loadingAction={loadingAction}
        onRunAudit={runSampleAudit}
        onRunHighRiseAudit={runHighRiseAudit}
        onRunCompliant8StoryAudit={runCompliant8StoryAudit}
        onUploadDXF={handleUploadDXF}
        onUploadImage={handleUploadImage}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Left Workbench Tabs Bar */}
        <SidebarTabs
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsPanelOpen(true);
            if (tab === 'building_graph') {
              setShowRAGOverlay(true);
            }
          }}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          violationsCount={pipelineData?.violations ? pipelineData.violations.length : 0}
          data={pipelineData}
        />

        {/* Center: 3D WebGL Canvas */}
        <main className={`flex-1 min-w-0 relative h-full bg-[var(--ui-bg)] ${isResizing ? 'pointer-events-none' : ''}`}>
          <ThreeScene
            data={pipelineData}
            activeFloor={activeFloor}
            explodedZ={explodedZ}
            wallHeightMode={wallHeightMode}
            cameraPreset={cameraPreset}
            simulationTime={simulationTime}
            showSmoke={showSmoke}
            showRAGOverlay={showRAGOverlay}
            showBottlenecks={showBottlenecks}
            showBIMArchitecture={showBIMArchitecture}
            showDoorArcs={showDoorArcs}
            onToggleDoorArcs={(show) => setShowDoorArcs(show)}
            cadDiffMode={cadDiffMode}
            onSelectElement={(el) => setSelectedElement(el)}
            onFloorChange={(fl) => setActiveFloor(fl)}
            onSimulationTimeChange={(t) => setSimulationTime(t)}
            isPlaying={isPlaying}
            onTogglePlay={(p) => setIsPlaying(p)}
            onResetCamera={() => setCameraPreset('isometric')}
            activeTab={activeTab}
          />

          {/* Bottom HUD: Timeline & Preset Controls */}
          <TimelineControls
            simulationTime={simulationTime}
            setSimulationTime={setSimulationTime}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            playbackSpeed={playbackSpeed}
            setPlaybackSpeed={setPlaybackSpeed}
            activeFloor={activeFloor}
            setActiveFloor={setActiveFloor}
            explodedZ={explodedZ}
            setExplodedZ={setExplodedZ}
            wallHeightMode={wallHeightMode}
            setWallHeightMode={setWallHeightMode}
            cameraPreset={cameraPreset}
            setCameraPreset={setCameraPreset}
            showSmoke={showSmoke}
            setShowSmoke={setShowSmoke}
            showRAGOverlay={showRAGOverlay}
            setShowRAGOverlay={setShowRAGOverlay}
            showBottlenecks={showBottlenecks}
            setShowBottlenecks={setShowBottlenecks}
            showBIMArchitecture={showBIMArchitecture}
            setShowBIMArchitecture={setShowBIMArchitecture}
            showDoorArcs={showDoorArcs}
            setShowDoorArcs={setShowDoorArcs}
            cadDiffMode={cadDiffMode}
            setCadDiffMode={setCadDiffMode}
            availableFloors={availableFloors}
            maxSimulationTime={Math.max(180, Math.ceil(pipelineData?.evacuation?.total_evacuation_time_s || pipelineData?.evacuation?.baseline_time_sec || 180))}
          />

          {/* Interactive Object Inspector Drawer */}
          <DetailsDrawer
            selectedElement={selectedElement}
            onClose={() => setSelectedElement(null)}
          />

          {/* Re-open Right Panel Floating Tab if collapsed */}
          {!isPanelOpen && (
            <button
              onClick={() => setIsPanelOpen(true)}
              className="absolute top-4 right-4 z-20 btn btn-secondary btn-sm shadow-md"
              title="Bağlamsal Analiz Panelini Aç"
            >
              <span>Sonuç Panelini Göster</span>
            </button>
          )}
        </main>

        {/* Resizable Splitter Handle (4px - 6px genişlik, col-resize imleci ve mavi vurgu) */}
        {isPanelOpen && (
          <div
            onMouseDown={handleSplitterMouseDown}
            className={`w-1.5 cursor-col-resize z-20 shrink-0 relative group select-none transition-colors ${
              isResizing ? 'bg-[#3b82f6]' : 'bg-[var(--ui-border)] hover:bg-[#3b82f6]'
            }`}
            title="Paneli sürükleyerek boyutlandır (280px - 650px)"
          >
            {/* Genişletilmiş fare yakalama alanı */}
            <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
          </div>
        )}

        {/* Right Workbench Detail Panel */}
        <div
          style={{ width: isPanelOpen ? `${panelWidth}px` : 0 }}
          className={`h-full border-l border-[var(--ui-border)] bg-[var(--ui-surface)] flex flex-col z-10 shrink-0 ${
            !isResizing ? 'transition-[width] duration-150 ease-out' : ''
          } ${!isPanelOpen ? 'w-0 overflow-hidden' : ''}`}
        >
          {isPanelOpen && (
            <div className="flex-1 flex flex-col h-full overflow-hidden w-full min-w-0">
              <div className="h-14 border-b border-[var(--ui-border)] px-4 flex items-center justify-between bg-[var(--ui-surface-raised)] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[var(--ui-text)]">
                    {activeTab === 'regulatory_library'
                      ? 'Mevzuat Kütüphanesi'
                      : activeTab === 'fire_audit'
                      ? 'Yangın Denetimi Sonuçları'
                      : activeTab === 'fire_checklist'
                      ? 'Kaçış Yolları ve Merdiven Kontrol Listesi'
                      : activeTab === 'basement_audit'
                      ? 'Bodrum Kat, Sığınak & Otopark Denetimi'
                      : activeTab === 'overview'
                      ? 'Proje Özeti & Bulgular'
                      : activeTab === 'cad_polygon'
                      ? 'CAD Kat Planı & Poligon Modeli'
                      : activeTab === 'dxf_preview'
                      ? 'DXF Pafta Çıktısı & İndirme'
                      : activeTab === 'cv_image'
                      ? 'OpenCV Plan Görü Analizi'
                      : activeTab === 'building_graph'
                      ? '3B Mekânsal RAG Grafı'
                      : activeTab === 'spminer'
                      ? 'SPMiner Sık Alt-Graf Madenciliği'
                      : activeTab === 'evacuation'
                      ? 'Çok Katlı Tahliye Simülasyonu'
                      : activeTab === 'optimization'
                      ? 'Karşı-Olgusal Tasarım Optimizasyonu'
                      : activeTab === 'regulatory_report'
                      ? 'Mevzuat Uygunluk Raporu'
                      : String(activeTab).replace(/_/g, ' ')}
                  </span>
                </div>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="btn btn-secondary btn-sm text-xs"
                  title="Paneli Gizle (3B Görünümü Genişlet)"
                >
                  Paneli Gizle
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-3.5rem)]">
                {activeTab === 'overview' && (
                  <OverviewPanel
                    data={pipelineData}
                    setActiveTab={setActiveTab}
                    onApplyOptimization={handleApplyOptimization}
                  />
                )}
                {activeTab === 'cad_polygon' && (
                  <CadPolygonPanel
                    data={pipelineData}
                    onSelectElement={(el) => setSelectedElement(el)}
                    activeFloor={activeFloor}
                    onFloorChange={(fl) => setActiveFloor(fl)}
                  />
                )}
                {activeTab === 'building_graph' && <SpatialRagPanel data={pipelineData} />}
                {activeTab === 'spminer' && <SpminerPanel data={pipelineData} />}
                {activeTab === 'fire_audit' && (
                  <FireAuditPanel
                    data={pipelineData}
                    onSelectViolation={(v) =>
                      setSelectedElement({ id: v.query_name, type: 'violation', details: v })
                    }
                    onOpenArticle={(artId) => setSelectedArticleId(artId)}
                  />
                )}
                {activeTab === 'fire_checklist' && (
                  <FireChecklistPanel
                    data={pipelineData}
                    onOpenArticle={(artId) => setSelectedArticleId(artId)}
                    onSelectChecklistItem={(it) =>
                      setSelectedElement({ id: it.item_id, type: 'checklist_item', details: it })
                    }
                  />
                )}
                {activeTab === 'basement_audit' && (
                  <BasementAuditPanel
                    data={pipelineData}
                    onSelectViolation={(v) =>
                      setSelectedElement({ id: v.rule_id, type: 'violation', details: v })
                    }
                  />
                )}
                {activeTab === 'evacuation' && (
                  <EvacuationPanel
                    data={pipelineData}
                    simulationTime={simulationTime}
                    setSimulationTime={setSimulationTime}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    playbackSpeed={playbackSpeed}
                    setPlaybackSpeed={setPlaybackSpeed}
                    onSelectElement={(el) => setSelectedElement(el)}
                    onRefreshAudit={() => {
                      if (pipelineData?.metadata?.total_floors && pipelineData.metadata.total_floors > 3) {
                        runHighRiseAudit();
                      } else {
                        runSampleAudit();
                      }
                    }}
                  />
                )}
                {activeTab === 'optimization' && (
                  <OptimizationPanel
                    data={pipelineData}
                    cadDiffMode={cadDiffMode}
                    setCadDiffMode={setCadDiffMode}
                    onDownloadDXF={handleDownloadDXF}
                  />
                )}
                {activeTab === 'dxf_preview' && (
                  <DxfExportPanel data={pipelineData} onDownloadDXF={handleDownloadDXF} />
                )}
                {activeTab === 'regulatory_library' && (
                  <RegulatoryLibraryPanel onOpenArticle={(artId) => setSelectedArticleId(artId)} />
                )}
                {activeTab === 'regulatory_report' && (
                  <RegulatoryReportPanel
                    data={pipelineData}
                    onOpenArticle={(artId) => setSelectedArticleId(artId)}
                  />
                )}
                {activeTab === 'cv_image' && (
                  <CvImagePanel data={pipelineData} onUploadImage={handleUploadImage} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Interactive Regulatory Article Inspection Modal */}
      <RegulatoryArticleModal
        articleId={selectedArticleId}
        onClose={() => setSelectedArticleId(null)}
        onSelectArticle={(id) => setSelectedArticleId(id)}
      />
    </div>
  );
};


export default App;
