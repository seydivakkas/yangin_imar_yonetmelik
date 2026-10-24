import React, { useState, useEffect } from 'react';
import { RegulationArticleDetail } from '../types/pipeline';

interface RegulatoryArticleModalProps {
  articleId: string | null;
  onClose: () => void;
  onSelectArticle?: (articleId: string) => void;
}

export const RegulatoryArticleModal: React.FC<RegulatoryArticleModalProps> = ({
  articleId,
  onClose,
  onSelectArticle,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [article, setArticle] = useState<RegulationArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'text' | 'parameters' | 'checklist' | 'violations'>('text');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!articleId) {
      setArticle(null);
      return;
    }

    setLoading(true);
    setError(null);
    setCheckedItems({});

    // Eğer articleId bir ihlal kodu ise veya direkt ID ise
    const cleanId = articleId.trim();
    const isDirectArticleId = /^(BYKHY|PAIY|SIGINAK|OTOPARK)-M\d+$/i.test(cleanId);

    const endpoint = isDirectArticleId
      ? `/api/regulations/article/${encodeURIComponent(cleanId)}`
      : `/api/regulations/by-violation/${encodeURIComponent(cleanId)}`;

    fetch(endpoint)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Mevzuat maddesi bulunamadı (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.matched !== undefined) {
          // by-violation endpoint yanıtı
          if (data.matched && data.article) {
            setArticle(data.article);
          } else {
            // fallback: direct search
            fetch(`/api/regulations/search?q=${encodeURIComponent(cleanId)}`)
              .then((r) => r.json())
              .then((sData) => {
                if (sData.results && sData.results.length > 0) {
                  setArticle(sData.results[0]);
                } else {
                  setError('Bu ihlal için indekslenmiş özel bir mevzuat maddesi bulunamadı.');
                }
              })
              .catch(() => setError('Mevzuat aranırken hata oluştu.'));
          }
        } else {
          setArticle(data);
        }
      })
      .catch((err) => {
        setError(err.message || 'Mevzuat maddesi yüklenemedi.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [articleId]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!articleId) return null;

  const toggleCheck = (idx: number) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyCitation = () => {
    if (!article) return;
    const text = `${article.regulation_name} (${article.article_number} - ${article.article_title})\n${article.official_gazette}\n${article.official_url}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeColor = (regCode: string) => {
    switch (regCode) {
      case 'BYKHY':
        return {
          bg: 'bg-red-950/80',
          border: 'border-red-500/60',
          text: 'text-red-400',
          glow: 'shadow-red-500/20',
        };
      case 'PAIY':
        return {
          bg: 'bg-cyan-950/80',
          border: 'border-cyan-500/60',
          text: 'text-cyan-400',
          glow: 'shadow-cyan-500/20',
        };
      case 'SIGINAK':
        return {
          bg: 'bg-amber-950/80',
          border: 'border-amber-500/60',
          text: 'text-amber-400',
          glow: 'shadow-amber-500/20',
        };
      case 'OTOPARK':
        return {
          bg: 'bg-emerald-950/80',
          border: 'border-emerald-500/60',
          text: 'text-emerald-400',
          glow: 'shadow-emerald-500/20',
        };
      default:
        return {
          bg: 'bg-slate-900',
          border: 'border-slate-600',
          text: 'text-slate-300',
          glow: 'shadow-none',
        };
    }
  };

  const colorStyles = article ? getBadgeColor(article.regulation_code) : getBadgeColor('BYKHY');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(14, 165, 233, 0.15)',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div className="flex-1 pr-4">
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 w-32 bg-slate-700 rounded"></div>
                <div className="h-6 w-72 bg-slate-700 rounded"></div>
              </div>
            ) : article ? (
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span
                    className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-md border ${colorStyles.bg} ${colorStyles.border} ${colorStyles.text}`}
                  >
                    {article.regulation_code} • {article.article_number}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {article.mandatory_status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {article.chapter}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{article.article_title}</span>
                </h2>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>📜 {article.official_gazette}</span>
                  <span>🏛️ {article.regulation_name}</span>
                </div>
              </div>
            ) : (
              <h2 className="text-lg font-semibold text-slate-300">Mevzuat Madde İnceleme</h2>
            )}
          </div>

          <div className="flex items-center gap-2">
            {article && (
              <>
                <button
                  onClick={copyCitation}
                  title="Resmi Madde Künyesini Kopyala"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
                >
                  {copied ? '✓ Kopyalandı' : '📋 Künye Kopyala'}
                </button>
                <a
                  href={article.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/50 transition flex items-center gap-1"
                  title="Mevzuat.gov.tr Resmi Sayfası"
                >
                  Mevzuat.gov.tr ↗
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
              title="Kapat (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sub-Tabs Nav */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 px-5 gap-2 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('text')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'text'
                ? 'border-cyan-400 text-cyan-300 font-semibold bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📄 Resmi Kanun Metni</span>
          </button>
          <button
            onClick={() => setActiveSubTab('parameters')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'parameters'
                ? 'border-cyan-400 text-cyan-300 font-semibold bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📐 Sayısal Kriterler & Parametreler</span>
            {article && Object.keys(article.numerical_parameters).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-cyan-400 text-[10px]">
                {Object.keys(article.numerical_parameters).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('checklist')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'checklist'
                ? 'border-cyan-400 text-cyan-300 font-semibold bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>✅ Mimari Kontrol Listesi</span>
            {article && article.architectural_checklist.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-emerald-400 text-[10px]">
                {article.architectural_checklist.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('violations')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'violations'
                ? 'border-cyan-400 text-cyan-300 font-semibold bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>⚠️ İlişkili İhlaller & Çözüm Rehberi</span>
            {article && article.associated_violation_codes.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-amber-400 text-[10px]">
                {article.associated_violation_codes.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm">Resmi mevzuat maddesi getiriliyor...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-semibold">Madde Detayı Yüklenemedi</p>
                <p className="text-xs text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && article && (
            <>
              {/* TAB 1: RESMİ KANUN METNİ */}
              {activeSubTab === 'text' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 text-sm leading-relaxed whitespace-pre-line text-slate-200 font-sans shadow-inner selection:bg-cyan-500 selection:text-black">
                    {article.full_text_tr}
                  </div>

                  {/* Etiketler ve Kısım Bilgisi */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-xs text-slate-400 font-medium">İlgili Konular:</span>
                    {article.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600 transition"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>

                  {/* Resmi Gazete Bilgilendirme Kutusu */}
                  <div className="p-3.5 rounded-lg bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-blue-100">Resmi Mevzuat Geçerliliği</p>
                      <p className="text-slate-300 mt-0.5">
                        Bu madde {article.official_gazette} uyarınca Türkiye Cumhuriyeti genelinde tüm yapı projelerinde yasal olarak bağlayıcıdır.
                      </p>
                    </div>
                    <a
                      href={article.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium whitespace-nowrap transition ml-4"
                    >
                      Resmi Gazetede Gör ↗
                    </a>
                  </div>
                </div>
              )}

              {/* TAB 2: SAYISAL KRİTERLER & FORMÜLLER */}
              {activeSubTab === 'parameters' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Bu madde uyarınca DiagramYönetmelik denetim motoru tarafından 3B mimari model üzerinde matematiksel olarak denetlenen sınır değerler:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(article.numerical_parameters).map(([key, value], idx) => {
                      const displayKey = key.replace(/_/g, ' ').toUpperCase();
                      const isHighImportance = typeof value === 'number' || typeof value === 'string';
                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-850/90 border border-slate-750 hover:border-slate-600 transition flex flex-col justify-between"
                        >
                          <div className="text-[11px] font-semibold text-slate-400 tracking-wide uppercase mb-1">
                            {displayKey}
                          </div>
                          <div className="text-base font-bold text-cyan-300 font-mono">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mimari Not */}
                  <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                    <p className="font-semibold text-white mb-1">📐 Nöro-Sembolik Doğrulama Notu:</p>
                    <p>
                      Sayısal kriterler CAD poligonlarından çıkarılan sınır çizgileri, net alanlar ve kaçış çizgisi A* diyagram mesafeleri üzerinden tolerans payı olmaksızın tam doğrulukla denetlenir.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: MİMARİ KONTROL LİSTESİ */}
              {activeSubTab === 'checklist' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      Ruhsat paftası veya uygulama çizimi teslimi öncesi mimar ve proje müellifi kontrol adımları:
                    </p>
                    <span className="text-xs text-emerald-400 font-mono font-medium">
                      {Object.values(checkedItems).filter(Boolean).length} / {article.architectural_checklist.length} Tamamlandı
                    </span>
                  </div>

                  <div className="space-y-2">
                    {article.architectural_checklist.map((item, idx) => {
                      const isChecked = !!checkedItems[idx];
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleCheck(idx)}
                          className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 select-none ${
                            isChecked
                              ? 'bg-emerald-950/30 border-emerald-500/50 text-slate-200'
                              : 'bg-slate-850 border-slate-750 hover:border-slate-600 text-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 w-4 h-4 rounded text-emerald-600 bg-slate-800 border-slate-700 focus:ring-emerald-500"
                          />
                          <span className={`text-xs leading-relaxed ${isChecked ? 'line-through text-slate-400' : ''}`}>
                            {item}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: İHLAL KODLARI & ÇÖZÜM REHBERİ */}
              {activeSubTab === 'violations' && (
                <div className="space-y-5">
                  {/* Tasarım Rehberi */}
                  {article.design_guidance_tr && (
                    <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1.5">
                        <span>💡 Mimari Çözüm ve Tasarım İyileştirme Önerisi:</span>
                      </h4>
                      <p className="text-xs leading-relaxed text-amber-100/90 font-sans">
                        {article.design_guidance_tr}
                      </p>
                    </div>
                  )}

                  {/* İlişkili İhlal Kodları */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2">
                      DiagramYönetmelik Tarafından Üretilen İlgili İhlal Kodları:
                    </h4>
                    <div className="space-y-2">
                      {article.associated_violation_codes.map((code, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-slate-850 border border-slate-750 flex items-center justify-between"
                        >
                          <code className="text-xs font-mono text-red-400 font-semibold">{code}</code>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500/30">
                            Otomatik Denetim
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Resmi Veri Tabanı:</span>
            <span className="font-semibold text-slate-300">T.C. Cumhurbaşkanlığı Mevzuat Bilgi Sistemi</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
