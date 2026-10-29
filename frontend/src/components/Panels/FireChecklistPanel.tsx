import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Flame,
  Layers,
  Ruler,
  FileCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Copy,
  Check,
  Filter,
  Sparkles,
  Info
} from 'lucide-react';
import {
  DiagramYonetmelikPipelineOutput,
  BuildingOccupancyClass,
  ComprehensiveBuildingChecklistReport,
  ChecklistVerificationItem
} from '../../types/pipeline';

interface FireChecklistPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onOpenArticle?: (articleId: string) => void;
  onSelectChecklistItem?: (item: ChecklistVerificationItem) => void;
}

const OCCUPANCY_OPTIONS: {
  key: BuildingOccupancyClass;
  title: string;
  icon: string;
  shortDesc: string;
}[] = [
  {
    key: 'konut',
    title: 'Çok Katlı Konut',
    icon: '🏢',
    shortDesc: 'Apartman ve rezidans blokları',
  },
  {
    key: 'hastane_saglik',
    title: 'Sağlık / Hastane',
    icon: '🏥',
    shortDesc: 'Yataklı tedavi, sedye tahliyesi',
  },
  {
    key: 'egitim_okul',
    title: 'Eğitim / Okul',
    icon: '🏫',
    shortDesc: 'Derslikler, amfiler, yüksek yoğunluk',
  },
  {
    key: 'otel_konaklama',
    title: 'Otel / Konaklama',
    icon: '🏨',
    shortDesc: 'Otel, yurt, uyuyan kullanıcı',
  },
  {
    key: 'toplanma_ticari',
    title: 'Toplanma / Ticari',
    icon: '🏛️',
    shortDesc: 'AVM, sinema, restoran, ofis',
  },
  {
    key: 'endustri_depo',
    title: 'Endüstri / Depo',
    icon: '🏭',
    shortDesc: 'Fabrika, atölye, kapalı otopark',
  },
];

const CATEGORY_META: Record<
  string,
  { title: string; desc: string; icon: React.ReactNode; color: string }
> = {
  '1_genel_parametreler': {
    title: '1. Genel Tasarım Esasları ve Parametreler',
    desc: 'Bina kullanım sınıfı, kullanıcı yükü, çıkmaz koridor derinliği ve azami kaçış mesafeleri',
    icon: <Building2 className="w-4 h-4" />,
    color: 'var(--ui-primary)',
  },
  '2_genislik_yukseklik': {
    title: '2. Genişlik ve Yükseklik Kriterleri',
    desc: 'Net temiz çıkış kapıları, koridor genişliği & yüksekliği, merdiven kolu ve bölünme',
    icon: <Ruler className="w-4 h-4" />,
    color: '#06b6d4',
  },
  '3_merdiven_geometrisi': {
    title: '3. Merdiven Geometrisi ve Fiziksel Ölçütler',
    desc: 'Rıht yüksekliği, basış genişliği, Blondel kuralı, baş kurtarma ve sahanlık düzeni',
    icon: <Layers className="w-4 h-4" />,
    color: '#8b5cf6',
  },
  '4_yangin_dayanimi_tesisat': {
    title: '4. Yangın Dayanımı, Korunma ve Tesisat Kriterleri',
    desc: '120 dk duvar, 90 dk kapı, yangın holü, basınçlandırma ve yasaklı cihaz/şaft denetimi',
    icon: <Flame className="w-4 h-4" />,
    color: '#f97316',
  },
  '5_konumlandirma_tahliye': {
    title: '5. Konumlandırma ve Tahliye Güvenliği',
    desc: 'Diyagonal (köşegen) ayrım kuralı, doğrudan dışarı açılma (%50) ve zemin kat 10m/15m',
    icon: <FileCheck className="w-4 h-4" />,
    color: '#10b981',
  },
};

export const FireChecklistPanel: React.FC<FireChecklistPanelProps> = ({
  data,
  onOpenArticle,
  onSelectChecklistItem,
}) => {
  const [selectedOccupancy, setSelectedOccupancy] = useState<BuildingOccupancyClass>('konut');
  const [sprinklerEnabled, setSprinklerEnabled] = useState<boolean>(true);
  const [report, setReport] = useState<ComprehensiveBuildingChecklistReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'failed' | 'passed'>('all');
  const [copied, setCopied] = useState<boolean>(false);

  // Modelden türetilen bina parametreleri - Yüklenen paftaya tam dinamik bağlı
  const totalFloors = useMemo(() => {
    if (data?.metadata?.total_floors) {
      return data.metadata.total_floors;
    }
    if (data?.nodes && data.nodes.length > 0) {
      const floors = new Set(data.nodes.map((n: any) => n.floor_level).filter((f: any) => typeof f === 'number'));
      if (floors.size > 0) return floors.size;
    }
    return 2;
  }, [data]);

  const buildingHeight = useMemo(() => {
    return totalFloors * 3.0;
  }, [totalFloors]);

  // Kontrol listesini API'den getir veya hesapla
  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occupancy_type: selectedOccupancy,
          sprinkler_enabled: sprinklerEnabled,
          building_height_m: buildingHeight,
          total_floors: totalFloors,
          floor_area_m2: data?.program?.residential_area_m2
            ? data.program.residential_area_m2 / Math.max(1, totalFloors)
            : 650.0,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setReport(json);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn('Backend checklist API fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, [selectedOccupancy, sprinklerEnabled, buildingHeight, totalFloors, data]);

  const toggleCategory = (catKey: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  const handleCopySummary = () => {
    if (!report) return;
    const lines: string[] = [
      `================================================================================`,
      `BİNALARIN YANGINDAN KORUNMASI HAKKINDA YÖNETMELİK (BYKHY) RESMİ KONTROL RAPORU`,
      `================================================================================`,
      `Yapı Kullanım Sınıfı: ${report.occupancy_title}`,
      `Sprinkler Sistemi: ${report.sprinkler_enabled ? 'MEVCUT (Avantajlı Eşikler)' : 'YOK'}`,
      `Yapı Yüksekliği: ${report.building_height_m} m | Toplam Kat: ${report.total_floors} Kat`,
      `Yüksek Bina Statüsü: ${report.is_high_rise ? 'EVET (Yapı Yüksekliği >= 21.50m)' : 'HAYIR'}`,
      `Genel Uyum Skoru: %${report.compliance_score_percent} (${report.passed_checks}/${report.total_checks} Kriter Sağlandı)`,
      `Kritik / Majör Kusur Sayısı: ${report.critical_violations.length}`,
      `--------------------------------------------------------------------------------`,
      ``,
    ];

    Object.entries(report.categories).forEach(([catKey, items]) => {
      const meta = CATEGORY_META[catKey];
      lines.push(`[${meta?.title || catKey}]`);
      items.forEach((it) => {
        const mark = it.is_compliant ? '[ ✓ SAĞLANDI ]' : '[ ✗ İHLAL ]';
        lines.push(`  ${mark} ${it.title_tr} (${it.legal_basis})`);
        lines.push(`       Hedef: ${it.target_value_str} | Ölçülen: ${it.actual_value_str}`);
        if (!it.is_compliant) {
          lines.push(`       Öneri: ${it.design_remedy_tr}`);
        }
      });
      lines.push('');
    });

    lines.push(`Rapor Üretim: DiagramYönetmelik Professional (c) 2026 Seydi Eryılmaz`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-4 text-[var(--ui-text)]">
      {/* 1. Bina Kullanım Sınıfı Seçim Alanı */}
      <div className="p-3.5 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--ui-text)] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--ui-primary)]" />
              Bina Kullanım Sınıfı ve Kaçış Kriterleri Seçici
            </h3>
            <p className="text-xs text-[var(--ui-text-muted)] mt-0.5">
              BYKHY Tablo 5.5B, Kısım 3 ve ilgili özel kullanım maddelerine göre kontrol listesi parametreleri
            </p>
          </div>

          {/* Sprinkler Toggle Switch */}
          <div className="flex items-center gap-2 bg-[var(--ui-bg)] px-3 py-1.5 rounded-md border border-[var(--ui-border)]">
            <Flame
              className={`w-4 h-4 ${
                sprinklerEnabled ? 'text-[var(--ui-primary)]' : 'text-[var(--ui-text-muted)]'
              }`}
            />
            <span className="text-xs font-medium text-[var(--ui-text)]">Sprinkler Sistemi:</span>
            <button
              onClick={() => setSprinklerEnabled(!sprinklerEnabled)}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                sprinklerEnabled
                  ? 'bg-[var(--ui-primary)] text-white'
                  : 'bg-[var(--ui-surface-raised)] text-[var(--ui-text-muted)] border border-[var(--ui-border)]'
              }`}
            >
              {sprinklerEnabled ? 'Var (Avantajlı)' : 'Yok'}
            </button>
          </div>
        </div>

        {/* 6 Bina Türü Butonları */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {OCCUPANCY_OPTIONS.map((opt) => {
            const isSelected = selectedOccupancy === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setSelectedOccupancy(opt.key)}
                className={`flex flex-col items-start p-2.5 rounded-md text-left transition-all border ${
                  isSelected
                    ? 'bg-[var(--ui-primary-subtle)] border-[var(--ui-primary)] shadow-sm'
                    : 'bg-[var(--ui-bg)] border-[var(--ui-border)] hover:border-[var(--ui-border-strong)]'
                }`}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span className="text-base">{opt.icon}</span>
                  <span
                    className={`text-xs font-semibold truncate ${
                      isSelected ? 'text-[var(--ui-primary)]' : 'text-[var(--ui-text)]'
                    }`}
                  >
                    {opt.title}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--ui-text-muted)] mt-1 line-clamp-1">
                  {opt.shortDesc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Uyum Skoru & Özet KPI Kartı */}
      {report && (
        <div className="p-3.5 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold text-white shadow-sm ${
                  report.compliance_score_percent >= 80
                    ? 'bg-[var(--ui-success)]'
                    : report.compliance_score_percent >= 50
                    ? 'bg-[var(--ui-warning)]'
                    : 'bg-[var(--ui-danger)]'
                }`}
              >
                <span className="text-base leading-none">%{report.compliance_score_percent}</span>
                <span className="text-[9px] font-normal uppercase opacity-90 mt-0.5">Uyum</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--ui-text)]">
                    {report.occupancy_title} BYKHY Uygunluk Raporu
                  </span>
                  {report.is_high_rise && (
                    <span className="badge badge-warning text-[10px]">
                      Yüksek Bina ({report.building_height_m}m)
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--ui-text-muted)] mt-0.5">
                  Toplam {report.total_checks} kontrol kriterinden {report.passed_checks} tanesi sağlandı,{' '}
                  <strong className="text-[var(--ui-danger)]">{report.failed_checks} kusur</strong> tespit edildi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Filtre Butonları */}
              <div className="flex items-center bg-[var(--ui-bg)] p-1 rounded-md border border-[var(--ui-border)] text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-[var(--ui-surface-raised)] font-medium text-[var(--ui-text)]'
                      : 'text-[var(--ui-text-muted)]'
                  }`}
                >
                  Tümü ({report.total_checks})
                </button>
                <button
                  onClick={() => setStatusFilter('failed')}
                  className={`px-2 py-1 rounded transition-colors ${
                    statusFilter === 'failed'
                      ? 'bg-[var(--ui-danger)] text-white font-medium'
                      : 'text-[var(--ui-danger)]'
                  }`}
                >
                  Kusurlar ({report.failed_checks})
                </button>
                <button
                  onClick={() => setStatusFilter('passed')}
                  className={`px-2 py-1 rounded transition-colors ${
                    statusFilter === 'passed'
                      ? 'bg-[var(--ui-success)] text-white font-medium'
                      : 'text-[var(--ui-success)]'
                  }`}
                >
                  Sağlanan ({report.passed_checks})
                </button>
              </div>

              {/* Rapor Kopyalama Butonu */}
              <button
                onClick={handleCopySummary}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs"
                title="Resmi Yangın Denetim Kontrol Listesini Panoya Kopyala"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[var(--ui-success)]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Kopyalandı' : 'Raporu Kopyala'}</span>
              </button>
            </div>
          </div>

          {/* İlerleme Çubuğu */}
          <div className="w-full bg-[var(--ui-bg)] h-2 rounded-full overflow-hidden border border-[var(--ui-border)]">
            <div
              className={`h-full transition-all duration-300 ${
                report.compliance_score_percent >= 80
                  ? 'bg-[var(--ui-success)]'
                  : report.compliance_score_percent >= 50
                  ? 'bg-[var(--ui-warning)]'
                  : 'bg-[var(--ui-danger)]'
              }`}
              style={{ width: `${report.compliance_score_percent}%` }}
            />
          </div>
        </div>
      )}

      {/* 3. Beş Ana Kategori Akordiyonu */}
      {report && (
        <div className="space-y-3">
          {Object.entries(report.categories).map(([catKey, items]) => {
            const meta = CATEGORY_META[catKey] || {
              title: catKey,
              desc: '',
              icon: <Layers className="w-4 h-4" />,
              color: 'var(--ui-primary)',
            };

            const isCollapsed = collapsedCategories[catKey];
            const filteredItems = items.filter((it) => {
              if (statusFilter === 'failed') return !it.is_compliant;
              if (statusFilter === 'passed') return it.is_compliant;
              return true;
            });

            if (filteredItems.length === 0 && statusFilter !== 'all') {
              return null;
            }

            const catFailedCount = items.filter((it) => !it.is_compliant).length;

            return (
              <div
                key={catKey}
                className="rounded-lg bg-[var(--ui-surface)] border border-[var(--ui-border)] overflow-hidden shadow-sm"
              >
                {/* Kategori Başlığı */}
                <button
                  onClick={() => toggleCategory(catKey)}
                  className="w-full px-4 py-3 bg-[var(--ui-surface-raised)] border-b border-[var(--ui-border)] flex items-center justify-between text-left hover:bg-[var(--ui-bg)] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--ui-text)]">
                        {meta.title}
                      </h4>
                      <p className="text-[11px] text-[var(--ui-text-muted)] line-clamp-1">
                        {meta.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {catFailedCount > 0 ? (
                      <span className="badge badge-danger text-[10px]">
                        {catFailedCount} Kusur
                      </span>
                    ) : (
                      <span className="badge badge-success text-[10px]">
                        Tam Uyum
                      </span>
                    )}
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-[var(--ui-text-muted)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--ui-text-muted)]" />
                    )}
                  </div>
                </button>

                {/* Kategori Maddeleri Listesi */}
                {!isCollapsed && (
                  <div className="divide-y divide-[var(--ui-border)]">
                    {filteredItems.map((item) => (
                      <div
                        key={item.item_id}
                        onClick={() => onSelectChecklistItem && onSelectChecklistItem(item)}
                        className={`p-3.5 transition-colors cursor-pointer hover:bg-[var(--ui-bg)] ${
                          !item.is_compliant
                            ? 'bg-[var(--ui-danger-subtle)]/30'
                            : 'bg-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1">
                            {item.is_compliant ? (
                              <CheckCircle2 className="w-4 h-4 text-[var(--ui-success)] shrink-0 mt-0.5" />
                            ) : (
                              <ShieldAlert className="w-4 h-4 text-[var(--ui-danger)] shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-[var(--ui-text)]">
                                  {item.title_tr}
                                </span>
                                <span className="badge badge-neutral text-[10px]">
                                  {item.legal_basis}
                                </span>
                                {!item.is_compliant && (
                                  <span className="badge badge-danger text-[10px]">
                                    {item.severity}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-[var(--ui-text-muted)]">
                                {item.mandatory_rule}
                              </p>

                              {/* Hedef ve Ölçülen Karşılaştırması */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                                <div className="p-2 rounded bg-[var(--ui-bg)] border border-[var(--ui-border)]">
                                  <span className="text-[10px] text-[var(--ui-text-muted)] block font-medium">
                                    YÖNETMELİK ASGARİ / AZAMİ HEDEFİ:
                                  </span>
                                  <span className="font-semibold text-[var(--ui-primary)] text-xs">
                                    {item.target_value_str}
                                  </span>
                                </div>
                                <div
                                  className={`p-2 rounded border ${
                                    item.is_compliant
                                      ? 'bg-[var(--ui-bg)] border-[var(--ui-border)]'
                                      : 'bg-[var(--ui-danger-subtle)] border-[var(--ui-danger)]'
                                  }`}
                                >
                                  <span className="text-[10px] text-[var(--ui-text-muted)] block font-medium">
                                    PROJEDE ÖLÇÜLEN DEĞER:
                                  </span>
                                  <span
                                    className={`font-semibold text-xs ${
                                      item.is_compliant
                                        ? 'text-[var(--ui-success)]'
                                        : 'text-[var(--ui-danger)]'
                                    }`}
                                  >
                                    {item.actual_value_str}
                                  </span>
                                </div>
                              </div>

                              {/* Kusur Çözüm Önerisi */}
                              {!item.is_compliant && (
                                <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                                  <div>
                                    <strong className="text-amber-400 font-medium">Tasarım Çözüm Önerisi: </strong>
                                    <span>{item.design_remedy_tr}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* İlgili Resmi Maddeyi Açma Butonu */}
                          {onOpenArticle && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const artMatch = item.legal_basis.match(/Madde\s+(\d+)/i);
                                const artNo = artMatch ? artMatch[1] : '30';
                                onOpenArticle(`BYKHY-M${artNo}`);
                              }}
                              className="btn btn-secondary btn-sm p-1.5 shrink-0"
                              title="Resmi Yönetmelik Maddesi Detayını Aç"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-[var(--ui-primary)]" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
