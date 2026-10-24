import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Network,
  Boxes,
  Flame,
  Warehouse,
  Activity,
  Sparkles,
  FileCode,
  FileText,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ActiveTab } from '../types/pipeline';

interface SidebarTabsProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
  violationsCount: number;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  violationsCount,
}) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string; badgeColor?: string }[] = [
    { id: 'overview', label: '1. Genel Bakış', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'cad_polygon', label: '2. CAD & Poligon', icon: <Layers className="w-4 h-4" /> },
    { id: 'building_graph', label: '3. 3B RAG Grafı', icon: <Network className="w-4 h-4" /> },
    { id: 'spminer', label: '4. SPMiner Modül', icon: <Boxes className="w-4 h-4" /> },
    {
      id: 'fire_audit',
      label: '5. Yangın Denetimi',
      icon: <Flame className="w-4 h-4 text-red-400" />,
      badge: '2 İhlal',
      badgeColor: 'badge-red',
    },
    {
      id: 'basement_audit',
      label: '6. Bodrum Denetimi',
      icon: <Warehouse className="w-4 h-4 text-purple-400" />,
      badge: '2 İhlal',
      badgeColor: 'badge-red',
    },
    { id: 'evacuation', label: '7. Tahliye Simülasyonu', icon: <Activity className="w-4 h-4 text-amber-400" /> },
    {
      id: 'optimization',
      label: '8. Optimizasyon',
      icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
      badge: '-18.5s',
      badgeColor: 'badge-green',
    },
    { id: 'dxf_preview', label: '9. DXF Pafta', icon: <FileCode className="w-4 h-4 text-cyan-400" /> },
    { id: 'regulatory_report', label: '10. Mevzuat & Rapor', icon: <FileText className="w-4 h-4" /> },
    { id: 'cv_image', label: '11. OpenCV Görü', icon: <ImageIcon className="w-4 h-4 text-indigo-400" /> },
  ];

  return (
    <aside
      className={`h-[calc(100vh-4rem)] border-r border-white/10 bg-[#070A11]/95 backdrop-blur-md flex flex-col justify-between transition-all duration-200 z-20 select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Tab List */}
      <div className="py-3 px-2 space-y-1 overflow-y-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold shadow-sm shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
              }`}
              title={isCollapsed ? tab.label : undefined}
            >
              <span className="shrink-0">{tab.icon}</span>
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between text-left overflow-hidden">
                  <span className="truncate">{tab.label}</span>
                  {tab.badge && (
                    <span className={`badge ${tab.badgeColor || 'badge-cyan'} text-[9px] shrink-0 ml-1`}>
                      {tab.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Collapse / Expand Toggle Button */}
      <div className="p-2 border-t border-white/10">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-xs"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!isCollapsed && <span>Menüyü Daralt</span>}
        </button>
      </div>
    </aside>
  );
};
