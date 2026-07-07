document.addEventListener('DOMContentLoaded', function() {
  const dataTypeButtons = document.querySelectorAll('.data-type-btn');
  const searchInput = document.getElementById('searchInput');
  const resetBtn = document.getElementById('resetSearchBtn');
  const newSearchBtn = document.getElementById('newSearchBtn');
  const tagButtons = document.querySelectorAll('.tag-btn');
  const articlesContainer = document.getElementById('articlesContainer');
  
  const searchCounter = document.getElementById('searchCounter');
  const noResults = document.getElementById('noResults');
  
  let allArticles = []; 
  
  let currentDataType = 'all'; 
  let currentTag = 'all';
  let searchQuery = '';
  let activeArticleId = null; 

  // Visual active mapping on startup
  const defaultDataTypeBtn = Array.from(dataTypeButtons).find(btn => 
    btn.getAttribute('data-type')?.toLowerCase() === currentDataType
  );
  if (defaultDataTypeBtn) defaultDataTypeBtn.classList.add('active');

  const defaultTagButton = Array.from(tagButtons).find(btn => 
    btn.getAttribute('data-value')?.toLowerCase() === currentTag
  );
  if (defaultTagButton) defaultTagButton.classList.add('active');

  // Async data ingestion from the local JSON registry database
  async function loadArticles() {
    try {
      const response = await fetch('articles.json');
      if (!response.ok) throw new Error('Failed to load JSON registry data');
      allArticles = await response.json();
      filterArticles();
    } catch (error) {
      console.error(error);
      if (articlesContainer) {
        articlesContainer.innerHTML = '<p style="color: red;">Could not fetch index. Please verify running via local development server.</p>';
      }
    }
  }

  function escapeRegExp(string) { 
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
  }

  function getHighlightedHTML(text, words) {
    if (words.length === 0 || !text) return text;
    let html = text;
    words.forEach(word => {
      const regex = new RegExp(`(${escapeRegExp(word)})`, 'gi');
      html = html.replace(regex, '<mark>$1</mark>');
    });
    return html;
  }

  // SØKEMOTOR: Nå optimalisert for lynraskt søk i KUN tittel og automatisk knapp-bytte
  function filterArticles() {
    if (!articlesContainer) return;
    const searchWords = searchQuery.split(' ').filter(Boolean);
    const isSearching = searchWords.length > 0;

    let filtered = [];

    if (isSearching) {
      // 1. Hvis brukeren SØKER: Søk ALLTID gjennom absolutt alle artikler (ignorer aktive knapper)
      filtered = allArticles.filter(article => {
        const titleText = (article.title || '').toLowerCase();
        return searchWords.every(word => titleText.includes(word));
      });

      // 2. AUTOMATISK KNAPP-OPPDATERING basert på søketreffene
      if (filtered.length > 0) {
        // Ta utgangspunkt i den første matchende artikkelen for å sette nye, relevante knapper
        const leader = filtered[0];
        currentDataType = (leader.dataType || 'all').toLowerCase().trim();
        currentTag = (leader.tags && leader.tags.length > 0 ? leader.tags[0] : 'all').toLowerCase().trim();
      }
    } else {
      // 3. Hvis brukeren IKKE søker: Filtrer vanlig basert på knappene som er trykket på
      filtered = allArticles.filter(article => {
        const dataType = (article.dataType || '').toLowerCase().trim();
        const tags = (article.tags || []).map(t => t.toLowerCase().trim());
        
        const matchesDataType = (currentDataType === 'all' || dataType === currentDataType);
        const matchesTag = (currentTag === 'all' || tags.includes(currentTag));
        
        return matchesDataType && matchesTag;
      });
    }

    // Oppdater det visuelle på knappene slik at de matcher gjeldende tilstand (currentDataType / currentTag)
    dataTypeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-type')?.toLowerCase() === currentDataType);
    });
    tagButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-value')?.toLowerCase() === currentTag);
    });
    // 4. Generer HTML dynamisk for kun de filtrerte artiklene
    articlesContainer.innerHTML = filtered.map(article => {
      const isExpanded = article.id === activeArticleId;
      const displayTitle = isSearching ? getHighlightedHTML(article.title, searchWords) : article.title;

      return `
        <article class="filterable" data-id="${article.id}">
          <h2>${displayTitle}</h2>
          <p class="abstract-text">${article.abstract || ''}</p>
          ${isExpanded 
            ? `<div class="full-content">
                 <p>${article.content || ''}</p>
                 ${article.identification ? `<div class="identification-content"><p>${article.identification}</p></div>` : ''}
                 ${article.authority ? `<div class="authority-content"><p>${article.authority}</p></div>` : ''}
               </div>` 
            : `<button class="read-more-btn">Read full description →</button>`
          }
        </article>
      `;
    }).join('');

    attachArticleClickEvents();
    updateSearchUI(filtered.length, isSearching);
  }

  function attachArticleClickEvents() {
    articlesContainer.querySelectorAll('.filterable').forEach(articleEl => {
      articleEl.addEventListener('click', function() {
        const articleId = parseInt(this.dataset.id, 10);
        const originalArticle = allArticles.find(a => a.id === articleId);
        
        if (originalArticle) {
          activeArticleId = (activeArticleId === articleId) ? null : articleId;
          
          // Ved klikk låser vi visningen til denne spesifikke artikkelens kategorier
          currentDataType = (originalArticle.dataType || 'all').toLowerCase().trim();
          currentTag = (originalArticle.tags?.find(tag => tag.toLowerCase() !== 'all') || 'all').toLowerCase().trim();
          
          searchInput.value = '';
          searchQuery = '';
          resetBtn.classList.add('invisible');
          
          filterArticles();

          if (activeArticleId === articleId) {
            const newRenderedEl = articlesContainer.querySelector(`[data-id="${articleId}"]`);
            if (newRenderedEl) newRenderedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });
  }

  function updateSearchUI(count, isSearching) {
    if (searchCounter) {
      const activeDataTypeBtn = Array.from(dataTypeButtons).find(btn => btn.classList.contains('active'));
      const activeTagBtn = Array.from(tagButtons).find(btn => btn.classList.contains('active'));
      
      const typeLabel = activeDataTypeBtn ? activeDataTypeBtn.textContent : currentDataType;
      const tagLabel = activeTagBtn ? activeTagBtn.textContent : currentTag;

      searchCounter.textContent = isSearching 
        ? `Søk fant ${count} formater. Relevante kategorier aktivert.`
        : `Viser ${count} formater under ${typeLabel} > ${tagLabel}`;
    }
    if (noResults) noResults.classList.toggle('hidden', count > 0);
  }

  function resetEntireRegistry() {
    searchInput.value = ''; 
    searchQuery = ''; 
    activeArticleId = null;
    currentDataType = 'all'; 
    currentTag = 'all';
    resetBtn.classList.add('invisible');
    filterArticles();
  }

  loadArticles();

  if (newSearchBtn) {
    newSearchBtn.addEventListener('click', function() {
      resetEntireRegistry();
      searchInput.focus();
    });
  }

  dataTypeButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Knapp-klikk nullstiller aktivt søk for å unngå kollisjoner
      searchInput.value = '';
      searchQuery = '';
      resetBtn.classList.add('invisible');
      activeArticleId = null;
      currentTag = 'all';

      const clickedType = this.getAttribute('data-type');
      currentDataType = (currentDataType === clickedType?.toLowerCase()) ? 'all' : clickedType.toLowerCase();
      
      filterArticles();
    });
  });

  searchInput.addEventListener('input', function(e) {
    searchQuery = e.target.value.toLowerCase().trim();
    activeArticleId = null; 
    resetBtn.classList.toggle('invisible', searchQuery.length === 0);
    filterArticles();
  });

  resetBtn.addEventListener('click', function() {
    resetEntireRegistry();
    searchInput.focus();
  });

  tagButtons.forEach(button => {
    button.addEventListener('click', function() {
      searchInput.value = ''; 
      searchQuery = ''; 
      activeArticleId = null; 
      resetBtn.classList.add('invisible');
      
      const clickedTag = this.getAttribute('data-value');
      currentTag = (currentTag === clickedTag?.toLowerCase()) ? 'all' : clickedTag.toLowerCase();
      
      filterArticles();
    });
  });
});
