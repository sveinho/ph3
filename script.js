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

  // SØKEMOTOR: Søker globalt i tittel ved søk, eller følger knapper ved vanlig navigasjon
  function filterArticles() {
    if (!articlesContainer) return;
    const searchWords = searchQuery.split(' ').filter(Boolean);
    const isSearching = searchWords.length > 0;

    let filtered = [];

    if (isSearching) {
      // Søk går ALLTID gjennom absolutt alle artikler og ignorerer midlertidig knappene
      filtered = allArticles.filter(article => {
        const titleText = (article.title || '').toLowerCase();
        return searchWords.every(word => titleText.includes(word));
      });
    } else {
      // Vanlig navigasjon følger valgte knapper
      filtered = allArticles.filter(article => {
        const dataType = (article.dataType || '').toLowerCase().trim();
        const tags = (article.tags || []).map(t => t.toLowerCase().trim());
        
        const matchesDataType = (currentDataType === 'all' || dataType === currentDataType);
        const matchesTag = (currentTag === 'all' || tags.includes(currentTag));
        
        return matchesDataType && matchesTag;
      });
    }

    // Oppdater det visuelle på knappene slik at de ALLTID reflekterer gjeldende filtre i minnet
    dataTypeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-type')?.toLowerCase() === currentDataType);
    });
    tagButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-value')?.toLowerCase() === currentTag);
    });
    // Generer HTML dynamisk for kun de filtrerte artiklene
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

  // Her skjer magien når brukeren velger å åpne en artikkel
  function attachArticleClickEvents() {
    articlesContainer.querySelectorAll('.filterable').forEach(articleEl => {
      articleEl.addEventListener('click', function() {
        const articleId = parseInt(this.dataset.id, 10);
        const originalArticle = allArticles.find(a => a.id === articleId);
        
        if (originalArticle) {
          // Hvis artikkelen allerede er åpen, lukker vi den. Ellers åpner vi den.
          activeArticleId = (activeArticleId === articleId) ? null : articleId;
          
          if (activeArticleId !== null) {
            // Siden en artikkel ble ÅPNET, oppdaterer vi knappene i bakgrunnen til å matche denne
            currentDataType = (originalArticle.dataType || 'all').toLowerCase().trim();
            currentTag = (originalArticle.tags?.find(tag => tag.toLowerCase() !== 'all') || 'all').toLowerCase().trim();
            
            // Vi nullstiller søkefeltet slik at trefflisten tilpasser seg den nye kategorien med en gang
            searchInput.value = '';
            searchQuery = '';
            resetBtn.classList.add('invisible');
          }
          
          // Kjør filteret på nytt for å tegne opp med utvidet innhold og korrekte knapper
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
        ? `Søk fant ${count} formater totalt i registeret.`
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
