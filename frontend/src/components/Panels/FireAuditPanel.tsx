import React, { useState } from 'react';
import { Flame, ShieldAlert, Cpu, CheckCircle2, Filter, Layers, Scale } from 'lucide-react';
import { DiagramYonetmelikPipelineOutput } from '../../types/pipeline';

interface FireAuditPanelProps {
  data: DiagramYonetmelikPipelineOutput | null;
  onSelectViolation: (v: any) => void;
}

export const FireAuditPanel: React.FC<FireAuditPanelProps> = ({
  data,
  onSelectViolation,
}) => {
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<'all' | number>('all');

  const allDiagnostics = [
    {
      query_name: 'BYKHY M.31: Yüksek Bina Çift Kaçış Merdiveni Denetimi',
      floor_level: 7,
      is_compliant: false,
      violation_energy: 2.15,
      candidate_subgraph_nodes: ['K7_yangin_merdiveni_1'],
      monomorphism_relaxation_stage: 3,
      root_cause_category: 'yetersiz_merdiven_sayisi',
      violated_constraints: ['min_escape_stairs_count >= 2 (Yüksek Bina: Yapı yüksekliği >= 21.50m / 8+ Kat)'],
      legal_article: 'Binaların Yangından Korunması Hakkında Yönetmelik - Madde 31 & Madde 48',
      suggested_fix: 'Kat planına yangına dayanıklı ikinci bir bağımsız kaçış merdiveni çekirdeği eklenmelidir.',
    },
    {
      query_name: 'BYKHY M.34: Yangın Güvenlik Holü Alanı ve İzolasyonu',
      floor_level: 7,
      is_compliant: false,
      violation_energy: 1.84,
      candidate_subgraph_nodes: ['K7_yangin_holu', 'D_7_yangin_holu'],
      monomorphism_relaxation_stage: 1,
      root_cause_category: 'hol_alani_yetersiz_veya_kapi_dar',
      violated_constraints: ['fire_safety_hall_area_min_3.0m2 (ölçülen: 2.0 m²)', 'door_width_min_1.20m (ölçülen: 0.90m)'],
      legal_article: 'Binaların Yangından Korunması Hakkında Yönetmelik - Madde 34',
      suggested_fix: 'Yangın güvenlik holü en az 3.0 m² alana ve kapısı 1.20m temiz genişliğe büyütülmelidir.',
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
    },
  ];

  const availableFloors = Array.from(new Set(allDiagnostics.map((d) => d.floor_level))).sort((a, b) => b - a);
  const filteredDiagnostics = selectedFloorFilter === 'all'
    ? allDiagnostics
    : allDiagnostics.filter((d) => d.floor_level === selectedFloorFilter);

  return (
    <div className="space-y-4 p-4 text-xs font-sans text-gray-200 overflow-y-auto max-h-full">
      {/* Header Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-blue-950/40 to-slate-900 border border-cyan-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="font-bold text-white text-xs">Kat Bazlı Tüm Yönetmelik Maddeleri Denetim Motoru</h4>
              <p className="text-[10px] text-gray-400">BYKHY (M.31, 33, 34, 48, 52, 62) · PAİY (M.5, 29, 34, 36) · Sığınak · Otopark</p>
            </div>
          </div>
          <span className="badge badge-cyan text-[10px] font-mono">Her Kat Ayrı</span>
        </div>
      </div>

      {/* Floor Filter Bar */}
      <div className="glass-panel p-2 flex items-center justify-between gap-1 text-[11px]">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span>Kat Filtresi:</span>
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
          {availableFloors.map((fl) => (
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
            {filteredDiagnostics.filter(d => !d.is_compliant).length} İhlal / {filteredDiagnostics.length} Kural
          </span>
        </div>

        {filteredDiagnostics.map((diag, idx) => (
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
                    <h6 className="font-semibold text-white text-xs">{diag.query_name}</h6>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Düğümler: {diag.candidate_subgraph_nodes.join(' → ')}
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
                    {diag.violated_constraints.map((c, i) => (
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
        ))}
      </div>
    </div>
  );
};
