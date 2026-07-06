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
  const MAX_SUMMARY_LENGTH = 100;

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

  // The primary query engine executing filter intersections inside RAM
  function filterArticles() {
    if (!articlesContainer) return;
    const searchWords = searchQuery.split(' ').filter(Boolean);
    const isSearching = searchWords.length > 0;

    // 1. Filtrer basert på gjeldende valg
    let filtered = allArticles.filter(article => {
      const dataType = (article.dataType || '').toLowerCase().trim();
      const tags = (article.tags || []).map(t => t.toLowerCase().trim());
      const titleText = (article.title || '').toLowerCase();
      const abstractText = (article.abstract || '').toLowerCase();
      const contentText = (article.content || '').toLowerCase();
      const identificationText = (article.identification || '').toLowerCase();
      
      const matchesDataType = (currentDataType.toLowerCase().trim() === 'all' || dataType === currentDataType.toLowerCase().trim());
      const matchesTag = (currentTag.toLowerCase().trim() === 'all' || tags.includes(currentTag.toLowerCase().trim()));
      
      // Søker i tittel, abstract, beskrivelse og identifikasjonsfeltet samtidig
      const matchesSearch = searchWords.every(word => 
        `${titleText} ${abstractText} ${contentText} ${identificationText} ${authorityText}`.includes(word)
      );
      
      return matchesDataType && matchesTag && matchesSearch;
    });

    // 2. AUTOMATISK AKTIVERING HVIS DET BARE ER 1 TREFF UNDER SØK:
    if (isSearching && filtered.length === 1) {
      const singleArticle = filtered[0];
      activeArticleId = singleArticle.id;
      
      const newDataType = singleArticle.dataType || 'all';
      const newTag = singleArticle.tags && singleArticle.tags.length > 0 ? singleArticle.tags[0] : 'all';
      
      currentDataType = newDataType;
      currentTag = newTag;

      dataTypeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-type')?.toLowerCase() === newDataType.toLowerCase());
      });
      tagButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-value')?.toLowerCase() === newTag.toLowerCase());
      });
    }

    // 3. Generer HTML dynamisk basert på (det potensielt oppdaterte) filteret
    articlesContainer.innerHTML = filtered.map(article => {
      const isExpanded = article.id === activeArticleId;
      const displayTitle = isSearching ? getHighlightedHTML(article.title, searchWords) : article.title;
      const displayAbstract = isSearching ? getHighlightedHTML(article.abstract, searchWords) : article.abstract;
      const displayContent = isSearching ? getHighlightedHTML(article.content, searchWords) : article.content;
      const displayIdentification = isSearching ? getHighlightedHTML(article.identification, searchWords) : article.identification;
      const displayAuthority = isSearching ? getHighlightedHTML(article.authority, searchWords) : article.authority; // NY

return `
  <article class="filterable" data-id="${article.id}">
    <h2>${displayTitle}</h2>
    <p class="abstract-text">${displayAbstract}</p>
    ${isExpanded 
      ? `<div class="full-content">
           <p>${displayContent}</p>
           ${article.identification ? `<div class="identification-content"><p>${displayIdentification}</p></div>` : ''}
           ${article.authority ? `<div class="authority-content"><p>${displayAuthority}</p></div>` : ''}
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
          
          const newDataType = originalArticle.dataType || 'all';
          const newTag = originalArticle.tags?.find(tag => tag.toLowerCase() !== 'all') || 'all';
          
          currentDataType = newDataType;
          currentTag = newTag;
          
          searchInput.value = '';
          searchQuery = '';
          resetBtn.classList.add('invisible');
          
          dataTypeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-type')?.toLowerCase() === newDataType.toLowerCase());
          });

          tagButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-value')?.toLowerCase() === newTag.toLowerCase());
          });
          
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

      searchCounter.textContent = `Showing ${count} formats under ${typeLabel} > ${tagLabel}`;
    }
    if (noResults) noResults.classList.toggle('hidden', count > 0);
  }

  // SENTRAL FUNKSJON FOR FULL NULLSTILLING
  function resetEntireRegistry() {
    searchInput.value = ''; 
    searchQuery = ''; 
    activeArticleId = null;
    currentDataType = 'all'; 
    currentTag = 'all';

    dataTypeButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-type')?.toLowerCase() === 'all'));
    tagButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-value')?.toLowerCase() === 'all'));

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

      tagButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-value')?.toLowerCase() === 'all'));

      const clickedType = this.getAttribute('data-type');
      if (currentDataType.toLowerCase() === clickedType?.toLowerCase()) {
        currentDataType = 'all';
      } else {
        currentDataType = clickedType;
      }
      
      dataTypeButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-type')?.toLowerCase() === currentDataType.toLowerCase()));
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
      if (currentTag.toLowerCase() === clickedTag?.toLowerCase()) {
        currentTag = 'all';
      } else {
        currentTag = clickedTag;
      }
      
      tagButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-value')?.toLowerCase() === currentTag.toLowerCase()));
      filterArticles();
    });
  });
});

