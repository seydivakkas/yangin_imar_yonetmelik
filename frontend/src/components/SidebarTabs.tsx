import React, { useState } from 'react';
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
  BookOpen,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Compass,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  ClipboardList
} from 'lucide-react';
import { ActiveTab, DiagramYonetmelikPipelineOutput } from '../types/pipeline';

interface SidebarTabsProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
  violationsCount: number;
  data?: DiagramYonetmelikPipelineOutput | null;
}

interface NavCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    badgeVariant?: 'danger' | 'warning' | 'success' | 'neutral' | 'primary';
  }[];
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  violationsCount,
  data,
}) => {
  // Yangın ve Bodrum denetimi ihlal sayılarını dinamik hesapla
  const fireViolationsCount = React.useMemo(() => {
    if (!data?.violations) return violationsCount;
    return data.violations.filter(
      (v: any) => !String(v.code || '').startsWith('SIGINAK') && !String(v.code || '').startsWith('OTOPARK')
    ).length;
  }, [data?.violations, violationsCount]);

  const basementViolationsCount = React.useMemo(() => {
    if (!data?.violations) return 0;
    return data.violations.filter(
      (v: any) =>
        (typeof v.floor_level === 'number' && v.floor_level < 0) ||
        String(v.code || '').startsWith('SIGINAK') ||
        String(v.code || '').startsWith('OTOPARK')
    ).length;
  }, [data?.violations]);

  const spminerCount = React.useMemo(() => {
    if (data?.spminer_macro_nodes && data.spminer_macro_nodes.length > 0) {
      return data.spminer_macro_nodes.length;
    }
    const sp = (data as any)?.spminer?.macro_nodes;
    if (Array.isArray(sp) && sp.length > 0) {
      return sp.length;
    }
    return 0;
  }, [data]);

  // 5 Ana Mantıksal Kategori Hiyerarşisi (Bilgi Mimarisi İyileştirmesi)
  const categories: NavCategory[] = [
    {
      id: 'general',
      title: 'Genel Bakış',
      icon: <Compass className="w-4 h-4 text-[var(--ui-text-dim)]" />,
      items: [
        {
          id: 'overview',
          label: 'Genel Bakış',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
      ],
    },
    {
      id: 'model_cad',
      title: 'Model ve CAD',
      icon: <Layers className="w-4 h-4 text-[var(--ui-text-dim)]" />,
      items: [
        {
          id: 'cad_polygon',
          label: 'CAD & Poligon',
          icon: <Layers className="w-4 h-4" />,
        },
        {
          id: 'dxf_preview',
          label: 'DXF Pafta Çıktısı',
          icon: <FileCode className="w-4 h-4" />,
        },
        {
          id: 'cv_image',
          label: 'OpenCV Görü Analizi',
          icon: <ImageIcon className="w-4 h-4" />,
        },
      ],
    },
    {
      id: 'analyses',
      title: 'Mühendislik Analizleri',
      icon: <Cpu className="w-4 h-4 text-[var(--ui-text-dim)]" />,
      items: [
        {
          id: 'building_graph',
          label: '3B RAG Grafı',
          icon: <Network className="w-4 h-4" />,
        },
        {
          id: 'spminer',
          label: 'SPMiner Modülü',
          icon: <Boxes className="w-4 h-4 text-[var(--ui-primary)]" />,
          badge: spminerCount > 0 ? `${spminerCount} Modül` : undefined,
          badgeVariant: 'primary',
        },
        {
          id: 'fire_audit',
          label: 'Yangın Denetimi',
          icon: <Flame className={`w-4 h-4 ${fireViolationsCount > 0 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'}`} />,
          badge: fireViolationsCount > 0 ? `${fireViolationsCount} İhlal` : 'Uygun',
          badgeVariant: fireViolationsCount > 0 ? 'danger' : 'success',
        },
        {
          id: 'fire_checklist',
          label: 'Kaçış & Merdiven Listesi',
          icon: <ShieldAlert className="w-4 h-4 text-[var(--ui-primary)]" />,
          badge: 'BYKHY 5 Kriter',
          badgeVariant: 'primary',
        },
        {
          id: 'basement_audit',
          label: 'Bodrum Denetimi',
          icon: <Warehouse className={`w-4 h-4 ${basementViolationsCount > 0 ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-success)]'}`} />,
          badge: basementViolationsCount > 0 ? `${basementViolationsCount} İhlal` : 'Uygun',
          badgeVariant: basementViolationsCount > 0 ? 'danger' : 'success',
        },
        {
          id: 'evacuation',
          label: 'Tahliye Simülasyonu',
          icon: <Activity className="w-4 h-4 text-[var(--ui-primary)]" />,
          badge: 'Tel Ali',
          badgeVariant: 'primary',
        },
        {
          id: 'optimization',
          label: 'Tasarım Optimizasyonu',
          icon: <Sparkles className="w-4 h-4 text-[var(--ui-success)]" />,
          badge: 'ASET/RSET',
          badgeVariant: 'success',
        },
      ],
    },
    {
      id: 'regulations',
      title: 'Mevzuat',
      icon: <ShieldCheck className="w-4 h-4 text-[var(--ui-text-dim)]" />,
      items: [
        {
          id: 'regulatory_library',
          label: 'Mevzuat Kütüphanesi',
          icon: <BookOpen className="w-4 h-4" />,
          badge: '4 Yönetmelik',
          badgeVariant: 'neutral',
        },
      ],
    },
    {
      id: 'reports',
      title: 'Raporlama',
      icon: <ClipboardList className="w-4 h-4 text-[var(--ui-text-dim)]" />,
      items: [
        {
          id: 'regulatory_report',
          label: 'Mevzuat & Denetim Raporu',
          icon: <FileText className="w-4 h-4" />,
        },
      ],
    },
  ];

  const getBadgeClass = (variant?: string) => {
    switch (variant) {
      case 'danger': return 'badge-danger';
      case 'warning': return 'badge-warning';
      case 'success': return 'badge-success';
      case 'primary': return 'badge-primary';
      default: return 'badge-neutral';
    }
  };

  return (
    <aside
      className={`h-[calc(100vh-4rem)] border-r border-[var(--ui-border)] bg-[var(--ui-surface)] flex flex-col justify-between transition-all duration-200 z-20 select-none ${
        isCollapsed ? 'w-14' : 'w-[220px]'
      }`}
    >
      {/* Scrollable Navigation List */}
      <div className="py-3 px-2 space-y-4 overflow-y-auto flex-1">
        {categories.map((cat) => (
          <div key={cat.id} className="space-y-1">
            {/* Category Header */}
            {!isCollapsed ? (
              <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--ui-text-dim)] flex items-center gap-2">
                <span>{cat.title}</span>
              </div>
            ) : (
              <div className="w-full flex justify-center py-1">
                <div className="w-6 h-px bg-[var(--ui-border)]" />
              </div>
            )}

            {/* Category Items */}
            {cat.items.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 relative ${
                    isActive
                      ? 'bg-[var(--ui-primary-subtle)] text-[var(--ui-primary)] font-semibold border-l-2 border-[var(--ui-primary)] pl-2.5 shadow-sm'
                      : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)] border-l-2 border-transparent'
                  }`}
                  title={isCollapsed ? `${cat.title} > ${tab.label}` : undefined}
                >
                  <span className={`shrink-0 ${isActive ? 'text-[var(--ui-primary)]' : 'text-[var(--ui-text-dim)]'}`}>
                    {tab.icon}
                  </span>
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between text-left overflow-hidden">
                      <span className="truncate">{tab.label}</span>
                      {tab.badge && (
                        <span className={`badge ${getBadgeClass(tab.badgeVariant)} text-xs shrink-0 ml-1.5`}>
                          {tab.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Collapse / Expand Toggle Button */}
      <div className="p-2 border-t border-[var(--ui-border)] bg-[var(--ui-surface)]">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-md text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)] transition-colors text-xs font-medium cursor-pointer"
          title={isCollapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!isCollapsed && <span>Menüyü Daralt</span>}
        </button>
      </div>
    </aside>
  );
};
