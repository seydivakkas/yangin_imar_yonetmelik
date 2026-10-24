import React, { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    // Tüm yönetmelikleri ve maddeleri getir
    setLoading(true);
    fetch('/api/regulations')
      .then((r) => r.json())
      .then(async (data) => {
        setRegulations(data.regulations || []);
        // Tüm yönetmeliklerin maddelerini yükle
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
      // Yönetmelik filtreleme
      if (selectedRegFilter !== 'ALL' && art.regulation_code !== selectedRegFilter) {
        return false;
      }
      // Arama filtresi
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchId = art.article_id.toLowerCase().includes(q);
      const matchNum = art.article_number.toLowerCase().includes(q);
      const matchTitle = art.article_title.toLowerCase().includes(q);
      const matchText = art.full_text_tr.toLowerCase().includes(q);
      const matchTags = art.tags.some((t) => t.toLowerCase().includes(q));
      const matchViolations = art.associated_violation_codes.some((v) => v.toLowerCase().includes(q));
      return matchId || matchNum || matchTitle || matchText || matchTags || matchViolations;
    });
  }, [articles, selectedRegFilter, searchQuery]);

  const getRegTheme = (code: string) => {
    switch (code) {
      case 'BYKHY':
        return {
          border: 'border-red-500/40 hover:border-red-500',
          bg: 'bg-red-950/20',
          badge: 'bg-red-900/60 text-red-300 border-red-500/40',
          accent: 'text-red-400',
        };
      case 'PAIY':
        return {
          border: 'border-cyan-500/40 hover:border-cyan-500',
          bg: 'bg-cyan-950/20',
          badge: 'bg-cyan-900/60 text-cyan-300 border-cyan-500/40',
          accent: 'text-cyan-400',
        };
      case 'SIGINAK':
        return {
          border: 'border-amber-500/40 hover:border-amber-500',
          bg: 'bg-amber-950/20',
          badge: 'bg-amber-900/60 text-amber-300 border-amber-500/40',
          accent: 'text-amber-400',
        };
      case 'OTOPARK':
        return {
          border: 'border-emerald-500/40 hover:border-emerald-500',
          bg: 'bg-emerald-950/20',
          badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40',
          accent: 'text-emerald-400',
        };
      default:
        return {
          border: 'border-slate-700',
          bg: 'bg-slate-900',
          badge: 'bg-slate-800 text-slate-300',
          accent: 'text-slate-400',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-750 p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/40">
                Resmi Mevzuat Bilgi Sistemi
              </span>
              <span className="text-xs text-slate-400">
                Türkiye Cumhuriyeti Hukuki Standartları
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              4 Temel İmar ve Yangın Mevzuatı Dijital İndeksi
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Her bir madde resmi kanun metni, kesin sayısal eşikler, mimari kontrol listesi, çözüm rehberi ve Mevzuat.gov.tr resmi bağlantısıyla indekslenmiştir. İlgili madde kartına tıklayarak tüm hukuki ve teknik detayları inceleyebilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
              <div className="text-xs text-slate-400">Toplam İndeksli Madde</div>
              <div className="text-xl font-bold text-cyan-400 font-mono">{articles.length} Madde</div>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
              <div className="text-xs text-slate-400">Yönetmelik Sayısı</div>
              <div className="text-xl font-bold text-emerald-400 font-mono">4 Yönetmelik</div>
            </div>
          </div>
        </div>

        {/* 4 Yönetmelik Hızlı Seçim Kartları */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {regulations.map((reg) => {
            const theme = getRegTheme(reg.code);
            const isSelected = selectedRegFilter === reg.code;
            return (
              <div
                key={reg.code}
                onClick={() => setSelectedRegFilter(isSelected ? 'ALL' : reg.code)}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? `${theme.bg} ${theme.border} ring-2 ring-cyan-500/40 shadow-lg`
                    : 'bg-slate-850/80 border-slate-750 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${theme.badge}`}>
                      {reg.code}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {reg.total_articles} Madde
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white line-clamp-1">{reg.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {reg.short_desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-750/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">R.G. {reg.official_gazette_no}</span>
                  <a
                    href={reg.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-0.5"
                  >
                    Resmi Portal ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Arama ve Filtreleme Kontrolleri */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        {/* Arama Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Mevzuat maddesi ara (örn: Madde 31, yangın merdiveni, sahanlık, sığınak, asansör, BYKHY-M40)..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-850 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Yönetmelik Filtre Butonları */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-medium">
          <button
            onClick={() => setSelectedRegFilter('ALL')}
            className={`px-3 py-2 rounded-lg border transition whitespace-nowrap ${
              selectedRegFilter === 'ALL'
                ? 'bg-slate-700 border-slate-600 text-white font-semibold'
                : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
            }`}
          >
            Tümü ({articles.length})
          </button>
          <button
            onClick={() => setSelectedRegFilter('BYKHY')}
            className={`px-3 py-2 rounded-lg border transition whitespace-nowrap ${
              selectedRegFilter === 'BYKHY'
                ? 'bg-red-950 border-red-500/60 text-red-300 font-semibold'
                : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
            }`}
          >
            BYKHY (Yangın)
          </button>
          <button
            onClick={() => setSelectedRegFilter('PAIY')}
            className={`px-3 py-2 rounded-lg border transition whitespace-nowrap ${
              selectedRegFilter === 'PAIY'
                ? 'bg-cyan-950 border-cyan-500/60 text-cyan-300 font-semibold'
                : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
            }`}
          >
            PAİY (İmar)
          </button>
          <button
            onClick={() => setSelectedRegFilter('SIGINAK')}
            className={`px-3 py-2 rounded-lg border transition whitespace-nowrap ${
              selectedRegFilter === 'SIGINAK'
                ? 'bg-amber-950 border-amber-500/60 text-amber-300 font-semibold'
                : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
            }`}
          >
            Sığınak Yön.
          </button>
          <button
            onClick={() => setSelectedRegFilter('OTOPARK')}
            className={`px-3 py-2 rounded-lg border transition whitespace-nowrap ${
              selectedRegFilter === 'OTOPARK'
                ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300 font-semibold'
                : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-slate-200'
            }`}
          >
            Otopark Yön.
          </button>
        </div>
      </div>

      {/* Maddeler Grid Listesi */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">4 Mevzuat Kütüphanesi İndeksleniyor...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
          <div className="text-3xl mb-2">🔍</div>
          <h3 className="text-base font-semibold text-slate-200">Aramanıza Uygun Madde Bulunamadı</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            "{searchQuery}" araması için herhangi bir mevzuat maddesi eşleşmedi. Farklı bir terim deneyebilir veya filtreleri sıfırlayabilirsiniz.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedRegFilter('ALL');
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold transition"
          >
            Filtreleri Temizle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArticles.map((art) => {
            const theme = getRegTheme(art.regulation_code);
            return (
              <div
                key={art.article_id}
                onClick={() => onOpenArticle(art.article_id)}
                className={`group p-4 rounded-xl border bg-slate-900/90 hover:bg-slate-850 transition duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-lg ${theme.border}`}
              >
                <div>
                  {/* Başlık ve Kod */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${theme.badge}`}>
                      {art.article_id}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {art.mandatory_status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition line-clamp-1">
                    {art.article_number}: {art.article_title}
                  </h3>

                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    📂 {art.chapter}
                  </p>

                  {/* Kanun Özeti */}
                  <p className="text-xs text-slate-300/80 mt-2.5 line-clamp-3 leading-relaxed font-sans">
                    {art.full_text_tr.replace(/\n+/g, ' ')}
                  </p>

                  {/* Sayısal Kriter Rozetleri */}
                  {Object.keys(art.numerical_parameters).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-800">
                      {Object.entries(art.numerical_parameters).slice(0, 3).map(([k, v], idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800/90 text-cyan-400 border border-slate-700/80"
                        >
                          {k.replace(/_/g, ' ')}: {String(v)}
                        </span>
                      ))}
                      {Object.keys(art.numerical_parameters).length > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-400">
                          +{Object.keys(art.numerical_parameters).length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Alt Aksiyon Butonları */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-cyan-400 font-semibold group-hover:underline flex items-center gap-1">
                    <span>Maddeyi İncele</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">↗</span>
                  </span>
                  <a
                    href={art.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] text-slate-400 hover:text-white transition"
                    title="Mevzuat.gov.tr'de Aç"
                  >
                    Resmi Gazete ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
