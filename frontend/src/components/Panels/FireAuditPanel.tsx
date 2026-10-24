import React, { useState } from 'react';
import { Flame, ShieldAlert, Cpu, CheckCircle2, Filter, Layers, Scale, BookOpen } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface FireAuditPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onSelectViolation: (v: any) => void;
}

interface DiagnosticItem {
  query_name: string;
  floor_level: number;
  is_compliant: boolean;
  violation_energy: number;
  candidate_subgraph_nodes: string[];
  monomorphism_relaxation_stage: number;
  root_cause_category: string;
  violated_constraints: string[];
  legal_article: string;
  suggested_fix: string;
  reg_tag: string;
}

export const FireAuditPanel: React.FC<FireAuditPanelProps> = ({
  data,
  onSelectViolation,
}) => {
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<'all' | number>('all');
  const [selectedRegCategory, setSelectedRegCategory] = useState<'all' | 'BYKHY' | 'PAIY' | 'SIGINAK' | 'OTOPARK'>('all');

  const fallbackDiagnostics: DiagnosticItem[] = [
    {
      query_name: 'BYKHY M.31 & M.48: Yüksek Bina Çift Kaçış Merdiveni Zorunluluğu',
      floor_level: 7,
      is_compliant: false,
      violation_energy: 2.15,
      candidate_subgraph_nodes: ['K7_yangin_merdiveni_1'],
      monomorphism_relaxation_stage: 3,
      root_cause_category: 'yetersiz_merdiven_sayisi',
      violated_constraints: ['min_escape_stairs_count >= 2 (Yüksek Bina: Yapı yüksekliği >= 21.50m / 8+ Kat)'],
      legal_article: 'Binaların Yangından Korunması Hakkında Yönetmelik - Madde 31 & Madde 48',
      suggested_fix: 'Kat planına yangına dayanıklı ikinci bir bağımsız kaçış merdiveni çekirdeği eklenmelidir.',
      reg_tag: 'BYKHY'
    },
    {
      query_name: 'BYKHY M.34: Yangın Güvenlik Holü Alanı ve İzolasyonu (3.0 - 6.0 m²)',
      floor_level: 7,
      is_compliant: false,
      violation_energy: 1.84,
      candidate_subgraph_nodes: ['K7_yangin_holu', 'D_7_yangin_holu'],
      monomorphism_relaxation_stage: 1,
      root_cause_category: 'hol_alani_yetersiz_veya_kapi_dar',
      violated_constraints: ['fire_safety_hall_area_min_3.0m2 (ölçülen: 2.0 m²)', 'door_width_min_1.20m (ölçülen: 0.90m)'],
      legal_article: 'Binaların Yangından Korunması Hakkında Yönetmelik - Madde 34',
      suggested_fix: 'Yangın güvenlik holü en az 3.0 m² alana ve kapısı 1.20m temiz genişliğe büyütülmelidir.',
      reg_tag: 'BYKHY'
    },
    {
      query_name: 'BYKHY M.32: Kaçış Merdiveni Kovanı Pozitif Basınçlandırma (50 Pa)',
      floor_level: 7,
      is_compliant: false,
      violation_energy: 1.75,
      candidate_subgraph_nodes: ['K7_merdiven_kovani'],
      monomorphism_relaxation_stage: 2,
      root_cause_category: 'basinclandirma_eksik',
      violated_constraints: ['pressurization_min_50_Pa (Yüksek Bina Kovan Şartı)'],
      legal_article: 'Binaların Yangından Korunması Hakkında Yönetmelik - Madde 32 & Madde 89',
      suggested_fix: 'Merdiven kovasına acil durum jeneratör beslemeli mekanik basınçlandırma menfezi yerleştirilmelidir.',
      reg_tag: 'BYKHY'
    },
    {
      query_name: 'BYKHY M.52 & M.53: Kat Koridoru Çıkmaz Mesafe Sınırı (Maks 15m)',
      floor_level: 7,
      is_compliant: false,
      violation_energy: 1.62,
      candidate_subgraph_nodes: ['K7_oda_1', 'K7_kat_koridoru'],
      monomorphism_relaxation_stage: 1,
      root_cause_category: 'tek_yonlu_kacis_mesafesi_asimi',
      violated_constraints: ['dead_end_corridor_max_15.0m (ölçülen: 20.4m)'],
      legal_article: 'Binaların Yangından Korunması Hakkında Yönetmelik - Madde 52 & Madde 53',
      suggested_fix: 'Koridor boyutu revize edilmeli veya ara yangın çıkış kapısı açılmalıdır.',
      reg_tag: 'BYKHY'
    },
    {
      query_name: 'BYKHY M.48: Kaçış Merdivenleri Arası Diyagonal Ayrım Kuralı',
      floor_level: 7,
      is_compliant: false,
      violation_energy: 1.55,
      candidate_subgraph_nodes: ['K7_merdiven_1', 'K7_merdiven_2'],
      monomorphism_relaxation_stage: 2,
      root_cause_category: 'merdivenler_arasi_mesafe_yetersiz',
      violated_constraints: ['stair_separation >= floor_diagonal / 3 (ölçülen: 8.5m, gereken: 12.0m)'],
      legal_article: 'Binaların Yangından Korunması Hakkında Yönetmelik - Madde 48',
      suggested_fix: 'Merdivenler duman bloğundan aynı anda etkilenmemesi için katın zıt akslarına kaydırılmalıdır.',
      reg_tag: 'BYKHY'
    },
    {
      query_name: 'PAİY M.29 & M.30: Kat Koridoru Asgari Temiz Genişliği (1.20m)',
      floor_level: 7,
      is_compliant: false,
      violation_energy: 1.35,
      candidate_subgraph_nodes: ['K7_kat_koridoru'],
      monomorphism_relaxation_stage: 1,
      root_cause_category: 'koridor_genislik_deficit',
      violated_constraints: ['corridor_clear_width_min_1.20m (ölçülen: 0.95m)'],
      legal_article: 'Planlı Alanlar İmar Yönetmeliği - Madde 29 & Madde 30',
      suggested_fix: 'Kat koridoru duvar aksı geriye çekilerek net genişlik en az 1.20m yapılmalıdır.',
      reg_tag: 'PAIY'
    },
    {
      query_name: 'PAİY M.34: Asansör Önü Kat Holü Derinliği (1.50m / 1.80m)',
      floor_level: 7,
      is_compliant: false,
      violation_energy: 1.10,
      candidate_subgraph_nodes: ['K7_asansor_holu'],
      monomorphism_relaxation_stage: 1,
      root_cause_category: 'asansor_on_alan_deficit',
      violated_constraints: ['elevator_lobby_depth_min_1.80m (ölçülen: 1.40m)'],
      legal_article: 'Planlı Alanlar İmar Yönetmeliği - Madde 34',
      suggested_fix: 'Asansör kapısı önündeki ortak bekleme holü en az 1.80m derinliğe çıkarılmalıdır.',
      reg_tag: 'PAIY'
    },
    {
      query_name: 'PAİY M.5: Engelli Erişilebilirliği Manevra Dönüş Çapı (Ø1.50m)',
      floor_level: 1,
      is_compliant: false,
      violation_energy: 0.95,
      candidate_subgraph_nodes: ['K1_kat_koridoru'],
      monomorphism_relaxation_stage: 1,
      root_cause_category: 'engelli_manevra_yetersiz',
      violated_constraints: ['wheelchair_turning_diameter_min_1.50m'],
      legal_article: 'Planlı Alanlar İmar Yönetmeliği - Madde 5',
      suggested_fix: 'Koridorun uygun bir noktasında tekerlekli sandalye dönüş cebi (1.50m x 1.50m) oluşturulmalıdır.',
      reg_tag: 'PAIY'
    },
    {
      query_name: 'Sığınak M.13: Çift Kapılı Sızdırmaz Hava Kilidi (Airlock min 1.50 m²)',
      floor_level: -1,
      is_compliant: false,
      violation_energy: 2.10,
      candidate_subgraph_nodes: ['B_siginak_girisi'],
      monomorphism_relaxation_stage: 3,
      root_cause_category: 'hava_kilidi_eksik',
      violated_constraints: ['cift_kapili_hava_kilidi_zorunlu (ölçülen: tek kapi)'],
      legal_article: 'Sığınak Yönetmeliği - Madde 13',
      suggested_fix: 'Sığınak giriş kapısı önüne en az 1.50 m² alanlı çift kapılı sızdırmaz hava kilidi eklenmelidir.',
      reg_tag: 'SIGINAK'
    },
    {
      query_name: 'BYKHY M.60 & Otopark M.6: Kapalı Otopark Doğrudan Merdiven Geçiş Yasağı',
      floor_level: -1,
      is_compliant: false,
      violation_energy: 2.40,
      candidate_subgraph_nodes: ['B_otopark', 'B_yangin_merdiveni'],
      monomorphism_relaxation_stage: 3,
      root_cause_category: 'otopark_dogrudan_kapi',
      violated_constraints: ['otoparktan_merdivene_dogrudan_gecis_yasaktir'],
      legal_article: 'Otopark Yönetmeliği & BYKHY Madde 60',
      suggested_fix: 'Otopark ile merdiven arasına yangına en az 60 dk dayanıklı yangın güvenlik holü yapılmalıdır.',
      reg_tag: 'OTOPARK'
    },
    {
      query_name: 'BYKHY M.33: Zemin Kat Kaçış Kapısı Dışa Açılış Yönü',
      floor_level: 0,
      is_compliant: true,
      violation_energy: 0.05,
      candidate_subgraph_nodes: ['K0_merdiven', 'K0_dis_cikis'],
      monomorphism_relaxation_stage: 0,
      root_cause_category: 'none',
      violated_constraints: [],
      legal_article: 'Binaların Yangından Korunması Hakkında Yönetmelik - Madde 33',
      suggested_fix: 'Uygun.',
      reg_tag: 'BYKHY'
    },
  ];

  // Live backend data conversion
  const activeDiagnostics: DiagnosticItem[] = (data?.violations && data.violations.length > 0)
    ? data.violations.map((v: any): DiagnosticItem => {
        let tag = 'BYKHY';
        const codeStr = String(v.code || '');
        if (codeStr.startsWith('PAIY')) tag = 'PAIY';
        else if (codeStr.startsWith('SIGINAK')) tag = 'SIGINAK';
        else if (codeStr.startsWith('OTOPARK')) tag = 'OTOPARK';

        return {
          query_name: `${codeStr.replace(/_/g, ' ')}`,
          floor_level: typeof v.floor_level === 'number' ? v.floor_level : 0,
          is_compliant: false,
          violation_energy: v.severity === 'CRITICAL' ? 2.5 : v.severity === 'MAJOR' ? 1.6 : 0.9,
          candidate_subgraph_nodes: v.target_node != null ? [`Düğüm #${v.target_node}`] : v.target_edge ? [`Kenar (${v.target_edge[0]}→${v.target_edge[1]})`] : ['Bina Geneli'],
          monomorphism_relaxation_stage: 1,
          root_cause_category: codeStr.toLowerCase(),
          violated_constraints: [v.description || '', `Mevcut: ${v.actual_value ?? '-'} | Gereken: ${v.expected_value ?? '-'}`],
          legal_article: v.regulation || 'İlgili Yönetmelik Maddesi',
          suggested_fix: v.remedy || 'Mevzuata uygun olarak revize edilmelidir.',
          reg_tag: tag
        };
      })
    : fallbackDiagnostics;

  const availableFloors: number[] = Array.from(new Set(activeDiagnostics.map((d: DiagnosticItem) => d.floor_level))).sort((a: number, b: number) => b - a);
  
  const filteredDiagnostics: DiagnosticItem[] = activeDiagnostics.filter((d: DiagnosticItem) => {
    const matchesFloor = selectedFloorFilter === 'all' || d.floor_level === selectedFloorFilter;
    const matchesReg = selectedRegCategory === 'all' || d.reg_tag === selectedRegCategory;
    return matchesFloor && matchesReg;
  });

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Header Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-blue-950/40 to-slate-900 border border-cyan-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="font-bold text-white text-xs">Kat Bazlı Tüm Yönetmelik Maddeleri Denetim Motoru</h4>
              <p className="text-[10px] text-gray-400">BYKHY (M.30, 31, 32, 33, 34, 40, 41, 48, 52, 60, 62, 74, 96, 107) · PAİY · Sığınak · Otopark</p>
            </div>
          </div>
          <span className="badge badge-cyan text-[10px] font-mono">Her Kat Ayrı</span>
        </div>
      </div>

      {/* Regulation Code Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-lg border border-white/5 overflow-x-auto text-[11px]">
        <button
          onClick={() => setSelectedRegCategory('all')}
          className={`px-2.5 py-1 rounded transition-all font-mono text-[10px] ${
            selectedRegCategory === 'all' ? 'bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/50' : 'text-gray-400 hover:text-white'
          }`}
        >
          Tüm Mevzuatlar
        </button>
        <button
          onClick={() => setSelectedRegCategory('BYKHY')}
          className={`px-2.5 py-1 rounded transition-all font-mono text-[10px] ${
            selectedRegCategory === 'BYKHY' ? 'bg-red-500/30 text-red-300 font-bold border border-red-500/50' : 'text-gray-400 hover:text-white'
          }`}
        >
          BYKHY (Yangın)
        </button>
        <button
          onClick={() => setSelectedRegCategory('PAIY')}
          className={`px-2.5 py-1 rounded transition-all font-mono text-[10px] ${
            selectedRegCategory === 'PAIY' ? 'bg-blue-500/30 text-blue-300 font-bold border border-blue-500/50' : 'text-gray-400 hover:text-white'
          }`}
        >
          PAİY (İmar)
        </button>
        <button
          onClick={() => setSelectedRegCategory('SIGINAK')}
          className={`px-2.5 py-1 rounded transition-all font-mono text-[10px] ${
            selectedRegCategory === 'SIGINAK' ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/50' : 'text-gray-400 hover:text-white'
          }`}
        >
          Sığınak
        </button>
        <button
          onClick={() => setSelectedRegCategory('OTOPARK')}
          className={`px-2.5 py-1 rounded transition-all font-mono text-[10px] ${
            selectedRegCategory === 'OTOPARK' ? 'bg-purple-500/30 text-purple-300 font-bold border border-purple-500/50' : 'text-gray-400 hover:text-white'
          }`}
        >
          Otopark
        </button>
      </div>

      {/* Floor Filter Bar */}
      <div className="glass-panel p-2 flex items-center justify-between gap-1 text-[11px]">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span>Kat:</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setSelectedFloorFilter('all')}
            className={`px-2 py-0.5 rounded font-mono text-[10px] ${
              selectedFloorFilter === 'all' ? 'bg-cyan-500 text-black font-bold' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            Tüm Katlar
          </button>
          {availableFloors.map((fl: number) => (
            <button
              key={fl}
              onClick={() => setSelectedFloorFilter(fl)}
              className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                selectedFloorFilter === fl ? 'bg-cyan-500 text-black font-bold' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {fl === 0 ? 'Zemin' : fl < 0 ? `B${Math.abs(fl)}` : `Kat ${fl}`}
            </button>
          ))}
        </div>
      </div>

      {/* Query Diagnostics List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h5 className="font-semibold text-gray-300 text-xs">Mevzuat Teşhis Sonuçları ({filteredDiagnostics.length})</h5>
          <span className="text-[10px] text-gray-400">
            {filteredDiagnostics.filter((d: DiagnosticItem) => !d.is_compliant).length} İhlal / {filteredDiagnostics.length} Kural
          </span>
        </div>

        {filteredDiagnostics.length === 0 ? (
          <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
            <div className="text-white font-medium text-xs">Seçilen Filtrede İhlal Bulunmuyor</div>
            <div className="text-[10px] text-gray-400">Bu kat/mevzuat kategorisinde tüm maddeler şartları sağlıyor.</div>
          </div>
        ) : (
          filteredDiagnostics.map((diag: DiagnosticItem, idx: number) => (
            <div
              key={idx}
              onClick={() => onSelectViolation(diag)}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                !diag.is_compliant
                  ? 'bg-red-950/25 border-red-500/30 hover:border-red-400 hover:bg-red-950/40'
                  : 'bg-slate-900/40 border-white/10 hover:border-emerald-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {!diag.is_compliant ? (
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="badge badge-purple text-[9px] font-mono">
                        {diag.floor_level === 0 ? 'Zemin Kat' : diag.floor_level < 0 ? `Bodrum Kat` : `Kat ${diag.floor_level}`}
                      </span>
                      <span className={`badge text-[9px] font-mono ${
                        diag.reg_tag === 'BYKHY' ? 'badge-red' : diag.reg_tag === 'PAIY' ? 'badge-cyan' : diag.reg_tag === 'SIGINAK' ? 'badge-amber' : 'badge-purple'
                      }`}>
                        {diag.reg_tag}
                      </span>
                      <h6 className="font-semibold text-white text-xs">{diag.query_name}</h6>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Elemanlar: {diag.candidate_subgraph_nodes.join(' → ')}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`badge ${!diag.is_compliant ? 'badge-red' : 'badge-green'} text-[9px]`}>
                    E_viol: {diag.violation_energy.toFixed(2)}
                  </span>
                </div>
              </div>

              {!diag.is_compliant && (
                <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1.5">
                  <div className="text-[10px] text-gray-400">
                    <span className="text-red-300 font-medium">İhlal Edilen Kısıtlar:</span>
                    <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-gray-200">
                      {diag.violated_constraints.map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-2 rounded bg-black/40 border border-white/5 space-y-1">
                    <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                      <Scale className="w-3 h-3 text-cyan-400" />
                      <span>Hukuki Dayanak: <strong className="text-gray-200">{diag.legal_article}</strong></span>
                    </div>
                    {diag.suggested_fix && (
                      <div className="text-[10px] text-emerald-400">
                        Önerilen Düzeltme: <span className="text-gray-300">{diag.suggested_fix}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
