import React, { useState, useEffect } from 'react';
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
import { BasementAuditPanel } from './components/Panels/BasementAuditPanel';
import { EvacuationPanel } from './components/Panels/EvacuationPanel';
import { OptimizationPanel } from './components/Panels/OptimizationPanel';
import { DxfExportPanel } from './components/Panels/DxfExportPanel';
import { RegulatoryReportPanel } from './components/Panels/RegulatoryReportPanel';
import { CvImagePanel } from './components/Panels/CvImagePanel';

import {
  ActiveTab,
  CameraPreset,
  DiagramYonetmelikPipelineOutput,
  WallHeightMode,
} from './types/pipeline';

export const App: React.FC = () => {
  const [pipelineData, setPipelineData] = useState<DiagramYonetmelikPipelineOutput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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

  // Feature Toggles
  const [showSmoke, setShowSmoke] = useState<boolean>(true);
  const [showRAGOverlay, setShowRAGOverlay] = useState<boolean>(true);
  const [showBottlenecks, setShowBottlenecks] = useState<boolean>(true);
  const [cadDiffMode, setCadDiffMode] = useState<'before' | 'after' | 'both'>('before');

  // Object Inspector
  const [selectedElement, setSelectedElement] = useState<{
    id: string;
    type: 'room' | 'door' | 'violation';
    details: any;
  } | null>(null);

  // Simulation Clock Tick
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setSimulationTime((prev) => {
          const next = prev + 0.5 * playbackSpeed;
          if (next >= 180) {
            setIsPlaying(false);
            return 180;
          }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Load Initial / Sample Data on mount
  const runSampleAudit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/audit/sample', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setPipelineData(json);
      } else {
        console.warn('Backend returned error or not running; loading client fallback.');
      }
    } catch (err) {
      console.warn('Using client mock pipeline data:', err);
    } finally {
      setIsLoading(false);
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
    window.open('/api/download/annotated-dxf', '_blank');
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
        onRunAudit={runSampleAudit}
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
          }}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          violationsCount={4}
        />

        {/* Center: 3D WebGL Canvas */}
        <main className="flex-1 relative h-full bg-[#070A11]">
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
            cadDiffMode={cadDiffMode}
            onSelectElement={(el) => setSelectedElement(el)}
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
            cadDiffMode={cadDiffMode}
            setCadDiffMode={setCadDiffMode}
          />

          {/* Interactive Object Inspector Drawer */}
          <DetailsDrawer
            selectedElement={selectedElement}
            onClose={() => setSelectedElement(null)}
          />
        </main>

        {/* Right Workbench Detail Panel */}
        <div
          className={`h-full border-l border-white/10 bg-[#0A0E1A]/95 backdrop-blur-xl flex flex-col transition-all duration-200 z-10 ${
            isPanelOpen ? 'w-96' : 'w-0'
          }`}
        >
          {isPanelOpen && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="h-12 border-b border-white/10 px-4 flex items-center justify-between bg-black/20">
                <span className="font-bold text-xs uppercase tracking-wider text-cyan-400 font-mono">
                  {activeTab.replace('_', ' ')}
                </span>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/5"
                >
                  Gizle
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {activeTab === 'overview' && (
                  <OverviewPanel
                    data={pipelineData}
                    setActiveTab={setActiveTab}
                    onApplyOptimization={handleApplyOptimization}
                  />
                )}
                {activeTab === 'cad_polygon' && <CadPolygonPanel data={pipelineData} />}
                {activeTab === 'building_graph' && <SpatialRagPanel data={pipelineData} />}
                {activeTab === 'spminer' && <SpminerPanel data={pipelineData} />}
                {activeTab === 'fire_audit' && (
                  <FireAuditPanel
                    data={pipelineData}
                    onSelectViolation={(v) =>
                      setSelectedElement({ id: v.query_name, type: 'violation', details: v })
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
                  <EvacuationPanel data={pipelineData} simulationTime={simulationTime} />
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
                {activeTab === 'regulatory_report' && (
                  <RegulatoryReportPanel data={pipelineData} />
                )}
                {activeTab === 'cv_image' && (
                  <CvImagePanel data={pipelineData} onUploadImage={handleUploadImage} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
