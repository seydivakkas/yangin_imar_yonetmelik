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
          bg: 'bg-[#2A1D22]',
          border: 'border-[var(--ui-danger)]/50',
          text: 'text-[var(--ui-danger)]',
          glow: '',
        };
      case 'PAIY':
        return {
          bg: 'bg-[var(--ui-surface-raised)]',
          border: 'border-[var(--ui-primary)]/50',
          text: 'text-[var(--ui-primary)]',
          glow: '',
        };
      case 'SIGINAK':
        return {
          bg: 'bg-[#26221A]',
          border: 'border-[var(--ui-warning)]/50',
          text: 'text-[var(--ui-warning)]',
          glow: '',
        };
      case 'OTOPARK':
        return {
          bg: 'bg-[#182924]',
          border: 'border-[var(--ui-success)]/50',
          text: 'text-[var(--ui-success)]',
          glow: '',
        };
      default:
        return {
          bg: 'bg-[var(--ui-surface-raised)]',
          border: 'border-[var(--ui-border)]',
          text: 'text-[var(--ui-text-muted)]',
          glow: '',
        };
    }
  };

  const colorStyles = article ? getBadgeColor(article.regulation_code) : getBadgeColor('BYKHY');

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl shadow-2xl overflow-hidden text-[var(--ui-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--ui-border)] bg-[var(--ui-surface-raised)]">
          <div className="flex-1 pr-4">
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 w-32 bg-[var(--ui-border)] rounded"></div>
                <div className="h-6 w-72 bg-[var(--ui-border)] rounded"></div>
              </div>
            ) : article ? (
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`px-2.5 py-0.5 text-[12px] font-bold uppercase rounded-md border ${colorStyles.bg} ${colorStyles.border} ${colorStyles.text}`}
                  >
                    {article.regulation_code} • {article.article_number}
                  </span>
                  <span className="text-[12px] px-2 py-0.5 rounded bg-[var(--ui-surface)] text-[var(--ui-text-muted)] border border-[var(--ui-border)]">
                    {article.mandatory_status}
                  </span>
                  <span className="text-[12px] text-[var(--ui-text-muted)]">
                    {article.chapter}
                  </span>
                </div>
                <h2 className="text-[20px] font-bold text-[var(--ui-text)] tracking-tight leading-snug">
                  {article.article_title}
                </h2>
                <div className="text-[13px] text-[var(--ui-text-muted)] mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>📜 {article.official_gazette}</span>
                  <span>🏛️ {article.regulation_name}</span>
                  {article.last_synced_at && (
                    <span className="text-[var(--ui-success)] font-mono text-[12px] bg-[#182924] px-2 py-0.5 rounded border border-[var(--ui-success)]/40">
                      ⚡ Canlı Senkronize: {article.last_synced_at}
                    </span>
                  )}
                  {article.sha256_hash && (
                    <span className="text-[var(--ui-primary)] font-mono text-[12px] bg-[var(--ui-surface)] px-2 py-0.5 rounded border border-[var(--ui-border)]" title={`SHA-256: ${article.sha256_hash}`}>
                      SHA-256: {article.sha256_hash.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <h2 className="text-[18px] font-bold text-[var(--ui-text)]">Mevzuat Madde İnceleme</h2>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {article && (
              <>
                <button
                  onClick={copyCitation}
                  title="Resmi Madde Künyesini Kopyala"
                  className="btn btn-outline text-[13px] py-1.5 px-3 flex items-center gap-1.5"
                >
                  {copied ? '✓ Kopyalandı' : '📋 Künye Kopyala'}
                </button>
                <a
                  href={article.official_iframe_url || article.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary text-[13px] py-1.5 px-3 flex items-center gap-1.5"
                  title="mevzuat.gov.tr Doğrulanmış Resmi Tam Metin (Zero-404)"
                >
                  <span>Resmi Mevzuat.gov.tr Tam Metni ↗</span>
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--ui-text-muted)] hover:text-white rounded-lg hover:bg-[var(--ui-surface)] border border-transparent hover:border-[var(--ui-border)] transition ml-1"
              title="Kapat (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sub-Tabs Nav */}
        <div className="flex border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 gap-3 text-[13px] font-medium overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('text')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'text'
                ? 'border-[var(--ui-primary)] text-[var(--ui-primary)] font-semibold bg-[var(--ui-primary)]/10'
                : 'border-transparent text-[var(--ui-text-muted)] hover:text-white'
            }`}
          >
            <span>📄 Resmi Kanun Metni</span>
          </button>
          <button
            onClick={() => setActiveSubTab('parameters')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'parameters'
                ? 'border-[var(--ui-primary)] text-[var(--ui-primary)] font-semibold bg-[var(--ui-primary)]/10'
                : 'border-transparent text-[var(--ui-text-muted)] hover:text-white'
            }`}
          >
            <span>📐 Sayısal Kriterler & Parametreler</span>
            {article && Object.keys(article.numerical_parameters || {}).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--ui-surface-raised)] text-[var(--ui-primary)] text-[12px] font-bold">
                {Object.keys(article.numerical_parameters || {}).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('checklist')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'checklist'
                ? 'border-[var(--ui-primary)] text-[var(--ui-primary)] font-semibold bg-[var(--ui-primary)]/10'
                : 'border-transparent text-[var(--ui-text-muted)] hover:text-white'
            }`}
          >
            <span>✅ Mimari Kontrol Listesi</span>
            {article && (article.architectural_checklist || []).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--ui-surface-raised)] text-[var(--ui-success)] text-[12px] font-bold">
                {(article.architectural_checklist || []).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('violations')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeSubTab === 'violations'
                ? 'border-[var(--ui-primary)] text-[var(--ui-primary)] font-semibold bg-[var(--ui-primary)]/10'
                : 'border-transparent text-[var(--ui-text-muted)] hover:text-white'
            }`}
          >
            <span>⚠️ İlişkili İhlaller & Çözüm Rehberi</span>
            {article && (article.associated_violation_codes || []).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--ui-surface-raised)] text-[var(--ui-warning)] text-[12px] font-bold">
                {(article.associated_violation_codes || []).length}
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
                  {/* Canlı Sayısal Sınırlar Barı */}
                  {article.mandatory_threshold_summary?.thresholds_found && article.mandatory_threshold_summary.thresholds_found.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-[#26221A] border border-[var(--ui-warning)]/40">
                      <div className="text-[13px] font-semibold text-[var(--ui-warning)] flex items-center gap-2 mb-2">
                        <span>⚡ Mevzuat Metninden Otomatik Tespit Edilen Yasal Eşikler:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {article.mandatory_threshold_summary.thresholds_found.map((th, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded bg-[var(--ui-surface-raised)] border border-[var(--ui-warning)]/50 text-[var(--ui-warning)] font-mono text-[12px] font-bold"
                          >
                            {th}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-5 rounded-lg bg-[var(--ui-bg)] border border-[var(--ui-border)] text-[15px] leading-relaxed whitespace-pre-line text-[var(--ui-text)] font-sans">
                    {article.official_text || article.full_text_tr}
                  </div>

                  {/* Etiketler ve Kısım Bilgisi */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[13px] text-[var(--ui-text-muted)] font-medium">İlgili Konular:</span>
                    {(article.tags || []).map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-[12px] rounded-md bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-[var(--ui-text-muted)]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>

                  {/* Resmi Gazete Bilgilendirme Kutusu (Zero-404 Garantili) */}
                  <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-[13px] text-[var(--ui-text-muted)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--ui-text)] flex items-center gap-2">
                        <span>🏛️ Resmi Mevzuat Geçerliliği ve Doğrulanmış Kaynak</span>
                      </p>
                      <p className="text-[13px] text-[var(--ui-text-muted)] mt-1">
                        Bu madde {article.official_gazette} uyarınca yasal olarak bağlayıcıdır. Doğrudan <code className="text-[var(--ui-primary)] font-mono">mevzuat.gov.tr</code> resmi fihrist kütüphanesinden açılır.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={article.official_iframe_url || article.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary text-[13px] py-2 px-3.5 whitespace-nowrap flex items-center gap-1.5"
                      >
                        <span>Resmi Tam Metin ↗</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SAYISAL KRİTERLER & FORMÜLLER */}
              {activeSubTab === 'parameters' && (
                <div className="space-y-4">
                  <p className="text-[14px] text-[var(--ui-text-muted)]">
                    Bu madde uyarınca DiagramYönetmelik denetim motoru tarafından 3B mimari model üzerinde matematiksel olarak denetlenen sınır değerler:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {Object.entries(article.numerical_parameters || {}).map(([key, value], idx) => {
                      const displayKey = key.replace(/_/g, ' ').toUpperCase();
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex flex-col justify-between"
                        >
                          <div className="text-[12px] font-semibold text-[var(--ui-text-muted)] tracking-wide uppercase mb-1">
                            {displayKey}
                          </div>
                          <div className="text-[17px] font-bold text-[var(--ui-primary)] font-mono">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mimari Not */}
                  <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] text-[13px] text-[var(--ui-text-muted)]">
                    <p className="font-semibold text-[var(--ui-text)] mb-1">📐 Nöro-Sembolik Doğrulama Notu:</p>
                    <p className="leading-relaxed">
                      Sayısal kriterler CAD poligonlarından çıkarılan sınır çizgileri, net alanlar ve kaçış çizgisi A* diyagram mesafeleri üzerinden tolerans payı olmaksızın tam doğrulukla denetlenir.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: MİMARİ KONTROL LİSTESİ */}
              {activeSubTab === 'checklist' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] text-[var(--ui-text-muted)]">
                      Ruhsat paftası veya uygulama çizimi teslimi öncesi mimar ve proje müellifi kontrol adımları:
                    </p>
                    <span className="text-[13px] text-[var(--ui-success)] font-mono font-bold">
                      {Object.values(checkedItems).filter(Boolean).length} / {(article.architectural_checklist || []).length} Tamamlandı
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(article.architectural_checklist || []).map((item, idx) => {
                      const isChecked = !!checkedItems[idx];
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleCheck(idx)}
                          className={`p-3.5 rounded-lg border transition cursor-pointer flex items-start gap-3 select-none ${
                            isChecked
                              ? 'bg-[#182924] border-[var(--ui-success)]/40 text-[var(--ui-text)]'
                              : 'bg-[var(--ui-surface-raised)] border-[var(--ui-border)] hover:border-[var(--ui-primary)] text-[var(--ui-text)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-1 w-4 h-4 rounded text-[var(--ui-primary)] bg-[var(--ui-surface)] border-[var(--ui-border)]"
                          />
                          <span className={`text-[14px] leading-relaxed ${isChecked ? 'line-through text-[var(--ui-text-muted)]' : ''}`}>
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
                <div className="space-y-4">
                  {/* Tasarım Rehberi */}
                  {article.design_guidance_tr && (
                    <div className="p-4 rounded-lg bg-[#26221A] border border-[var(--ui-warning)]/40 text-[var(--ui-text)]">
                      <h4 className="text-[13px] font-bold uppercase tracking-wider text-[var(--ui-warning)] mb-1 flex items-center gap-1.5">
                        <span>💡 Mimari Çözüm ve Tasarım İyileştirme Önerisi:</span>
                      </h4>
                      <p className="text-[14px] leading-relaxed">
                        {article.design_guidance_tr}
                      </p>
                    </div>
                  )}

                  {/* İlişkili İhlal Kodları */}
                  <div className="space-y-2.5">
                    <h4 className="text-[14px] font-bold text-[var(--ui-text)]">
                      DiagramYönetmelik Tarafından Üretilen İlgili İhlal Kodları:
                    </h4>
                    <div className="space-y-2">
                      {(article.associated_violation_codes || []).map((code, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] flex items-center justify-between"
                        >
                          <code className="text-[14px] font-mono text-[var(--ui-danger)] font-bold">{code}</code>
                          <span className="badge badge-danger text-[12px] font-mono">
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
        <div className="p-4 border-t border-[var(--ui-border)] bg-[var(--ui-surface-raised)] flex items-center justify-between text-[13px] text-[var(--ui-text-muted)]">
          <div className="flex items-center gap-2">
            <span>Resmi Veri Tabanı:</span>
            <span className="font-semibold text-[var(--ui-text)]">T.C. Cumhurbaşkanlığı Mevzuat Bilgi Sistemi</span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-outline text-[13px] py-1.5 px-4"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
