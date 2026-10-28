import React, { useState, useEffect, useMemo } from 'react';
import { Search, ExternalLink, Filter, BookOpen, ChevronRight, SlidersHorizontal, List, LayoutGrid } from 'lucide-react';
import { RegulationMetadata, RegulationArticleDetail } from '../../types/pipeline';

interface RegulatoryLibraryPanelProps {
  onOpenArticle: (articleId: string) => void;
}

export const RegulatoryLibraryPanel: React.FC<RegulatoryLibraryPanelProps> = ({ onOpenArticle }) => {
  const [regulations, setRegulations] = useState<RegulationMetadata[]>([]);
  const [articles, setArticles] = useState<RegulationArticleDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegFilter, setSelectedRegFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  useEffect(() => {
    setLoading(true);
    fetch('/api/regulations')
      .then((r) => r.json())
      .then(async (data) => {
        setRegulations(data.regulations || []);
        const allArts: RegulationArticleDetail[] = [];
        for (const reg of data.regulations) {
          try {
            const res = await fetch(`/api/regulations/${reg.code}`);
            const regData = await res.json();
            if (regData.articles) {
              allArts.push(...regData.articles);
            }
          } catch (e) {
            console.error('Yönetmelik maddeleri yüklenemedi:', reg.code, e);
          }
        }
        setArticles(allArts);
      })
      .catch((err) => {
        console.error('Mevzuat listesi alınamadı:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      if (selectedRegFilter !== 'ALL' && art.regulation_code !== selectedRegFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchId = art.article_id.toLowerCase().includes(q);
      const matchNum = art.article_number.toLowerCase().includes(q);
      const matchTitle = art.article_title.toLowerCase().includes(q);
      const matchText = art.full_text_tr.toLowerCase().includes(q);
      const matchTags = art.tags?.some((t) => t.toLowerCase().includes(q));
      const matchViolations = art.associated_violation_codes?.some((v) => v.toLowerCase().includes(q));
      return matchId || matchNum || matchTitle || matchText || matchTags || matchViolations;
    });
  }, [articles, selectedRegFilter, searchQuery]);

  const getRegCodeLabel = (code: string) => {
    switch (code) {
      case 'BYKHY': return { name: 'Binaların Yangından Korunması Hakkında Yönetmelik', tag: 'Yangın Güvenliği' };
      case 'PAIY': return { name: 'Planlı Alanlar İmar Yönetmeliği', tag: 'İmar & Boyut' };
      case 'SIGINAK': return { name: '3194 Sayılı İmar Kanunu Sığınak Yönetmeliği', tag: 'Sığınak Hukuku' };
      case 'OTOPARK': return { name: 'Otopark Yönetmeliği', tag: 'Otopark Eşikleri' };
      default: return { name: code, tag: 'Mevzuat' };
    }
  };

  return (
    <div className="space-y-5 text-[var(--ui-text)]">
      {/* Overview & Regulations Bar */}
      <div className="p-4 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[var(--ui-text)] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[var(--ui-primary)]" />
              Mevzuat Bilgi Sistemi ve İndeks Kütüphanesi
            </h2>
            <p className="text-xs text-[var(--ui-text-muted)] mt-0.5">
              Resmi Gazete yayımlı 4 temel mevzuatın mimari sayısal parametreleri ve denetim kuralları
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-neutral text-xs">
              Toplam {articles.length} Madde
            </span>
            <span className="badge badge-primary text-xs">
              4 Temel Yönetmelik
            </span>
          </div>
        </div>

        {/* 4 Regulation Quick Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          {regulations.map((reg) => {
            const isSelected = selectedRegFilter === reg.code;
            const meta = getRegCodeLabel(reg.code);
            return (
              <button
                key={reg.code}
                onClick={() => setSelectedRegFilter(isSelected ? 'ALL' : reg.code)}
                className={`p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--ui-primary-subtle)] border-[var(--ui-primary)] text-[var(--ui-primary)] shadow-sm'
                    : 'bg-[var(--ui-bg)] border-[var(--ui-border)] hover:border-[var(--ui-border-light)] text-[var(--ui-text)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">{reg.code}</span>
                  <span className="text-xs text-[var(--ui-text-dim)] font-mono">{reg.total_articles} Madde</span>
                </div>
                <div className="text-xs text-[var(--ui-text-muted)] truncate font-medium">
                  {reg.name}
                </div>
                <div className="text-[11px] text-[var(--ui-text-dim)] mt-1 flex items-center justify-between">
                  <span>R.G. {reg.official_gazette_no}</span>
                  <a
                    href={reg.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[var(--ui-primary)] hover:underline inline-flex items-center gap-0.5"
                    title="Mevzuat.gov.tr'de Orijinal Metni İncele"
                  >
                    Resmi Portal <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)]">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--ui-text-dim)]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Mevzuat maddesi veya teknik kural ara (örn: Madde 31, merdiven, sığınak, asansör)..."
            className="input-text pl-9 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--ui-text-dim)] hover:text-[var(--ui-text)]"
            >
              ✕
            </button>
          )}
        </div>

        {/* View Mode & Filter Reset */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-[var(--ui-bg)] p-0.5 rounded-md border border-[var(--ui-border)]">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition ${
                viewMode === 'list' ? 'bg-[var(--ui-surface-raised)] text-[var(--ui-primary)] shadow-sm' : 'text-[var(--ui-text-dim)] hover:text-[var(--ui-text)]'
              }`}
              title="Liste Görünümü (Okunabilir Mühendislik Tablosu)"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded transition ${
                viewMode === 'card' ? 'bg-[var(--ui-surface-raised)] text-[var(--ui-primary)] shadow-sm' : 'text-[var(--ui-text-dim)] hover:text-[var(--ui-text)]'
              }`}
              title="Kart Görünümü"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {selectedRegFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedRegFilter('ALL')}
              className="btn btn-secondary btn-sm text-xs"
            >
              Filtreyi Temizle ({selectedRegFilter})
            </button>
          )}
        </div>
      </div>

      {/* Content Rendering: Loading / Empty / Data */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--ui-text-muted)] space-y-3">
          <div className="w-7 h-7 border-2 border-[var(--ui-primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">Mevzuat kütüphanesi yükleniyor...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="p-10 text-center rounded-lg bg-[var(--ui-surface-raised)] border border-[var(--ui-border)] space-y-3">
          <div className="w-10 h-10 rounded-full bg-[var(--ui-bg)] flex items-center justify-center mx-auto text-[var(--ui-text-dim)]">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-[var(--ui-text)]">
            Eşleşen Mevzuat Maddesi Bulunamadı
          </h3>
          <p className="text-sm text-[var(--ui-text-muted)] max-w-md mx-auto">
            "{searchQuery}" aramanız için sonuç bulunamadı. Arama terimini değiştirebilir veya filtreleri sıfırlayabilirsiniz.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedRegFilter('ALL');
            }}
            className="btn btn-secondary btn-sm mt-2"
          >
            Tüm Maddeleri Göster
          </button>
        </div>
      ) : viewMode === 'list' ? (
        /* Profesyonel Liste / Tablo Görünümü */
        <div className="space-y-2">
          <div className="text-xs text-[var(--ui-text-dim)] px-1 font-medium">
            Gösterilen: {filteredArticles.length} / {articles.length} Madde
          </div>

          <div className="divide-y divide-[var(--ui-border)] rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] overflow-hidden">
            {filteredArticles.map((art) => (
              <div
                key={art.article_id}
                onClick={() => onOpenArticle(art.article_id)}
                className="p-3.5 hover:bg-[var(--ui-surface-hover)] transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-primary font-mono text-xs font-semibold">
                      {art.article_id}
                    </span>
                    <span className="badge badge-neutral text-xs">
                      {art.mandatory_status || 'Zorunlu Hüküm'}
                    </span>
                    <span className="text-xs text-[var(--ui-text-dim)]">
                      {art.chapter}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-[var(--ui-text)] group-hover:text-[var(--ui-primary)] transition-colors">
                    {art.article_number}: {art.article_title}
                  </div>

                  <p className="text-xs text-[var(--ui-text-muted)] line-clamp-2 leading-relaxed">
                    {art.full_text_tr.replace(/\n+/g, ' ')}
                  </p>

                  {/* Sayısal Parametreler */}
                  {Object.keys(art.numerical_parameters || {}).length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {Object.entries(art.numerical_parameters).slice(0, 4).map(([k, v], idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs font-mono rounded bg-[var(--ui-bg)] text-[var(--ui-text-muted)] border border-[var(--ui-border)]"
                        >
                          <span className="text-[var(--ui-text-dim)]">{k.replace(/_/g, ' ')}:</span>{' '}
                          <span className="text-[var(--ui-text)] font-semibold">{String(v)}</span>
                        </span>
                      ))}
                      {Object.keys(art.numerical_parameters).length > 4 && (
                        <span className="text-xs text-[var(--ui-text-dim)]">
                          +{Object.keys(art.numerical_parameters).length - 4} parametre
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <a
                    href={art.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="btn btn-secondary btn-sm text-xs"
                    title="Mevzuat.gov.tr Resmi Gazete Metnini Aç"
                  >
                    <span>Resmi Metin</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => onOpenArticle(art.article_id)}
                    className="btn btn-primary btn-sm text-xs"
                    title="Madde Analizini ve Sayısal Denetim Detaylarını Aç"
                  >
                    <span>İncele</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Düzenli Kart Görünümü (Okunabilir 2-Sütunlu Izgara) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredArticles.map((art) => (
            <div
              key={art.article_id}
              onClick={() => onOpenArticle(art.article_id)}
              className="p-4 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-hover)] hover:border-[var(--ui-border-light)] transition cursor-pointer flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="badge badge-primary font-mono text-xs font-semibold">
                    {art.article_id}
                  </span>
                  <span className="badge badge-neutral text-xs">
                    {art.mandatory_status || 'Zorunlu'}
                  </span>
                </div>

                <div className="text-sm font-semibold text-[var(--ui-text)] group-hover:text-[var(--ui-primary)] transition-colors">
                  {art.article_number}: {art.article_title}
                </div>

                <div className="text-xs text-[var(--ui-text-dim)]">
                  {art.chapter}
                </div>

                <p className="text-xs text-[var(--ui-text-muted)] line-clamp-3 leading-relaxed">
                  {art.full_text_tr.replace(/\n+/g, ' ')}
                </p>

                {Object.keys(art.numerical_parameters || {}).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(art.numerical_parameters).slice(0, 3).map(([k, v], idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs font-mono rounded bg-[var(--ui-bg)] text-[var(--ui-text-muted)] border border-[var(--ui-border)]"
                      >
                        {k.replace(/_/g, ' ')}: <strong className="text-[var(--ui-text)]">{String(v)}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2.5 border-t border-[var(--ui-border)] flex items-center justify-between text-xs">
                <span className="text-[var(--ui-primary)] font-medium inline-flex items-center gap-1 group-hover:underline">
                  Madde Detayı <ChevronRight className="w-3.5 h-3.5" />
                </span>
                <a
                  href={art.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--ui-text-dim)] hover:text-[var(--ui-text)] inline-flex items-center gap-0.5"
                >
                  Resmi Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
