const state = {
  allFilms: [],
  cart: []
};

const elements = {
  tableBody: document.querySelector('#filmovi-tablica tbody'),
  filterGenre: document.querySelector('#filter-genre'),
  filterCountry: document.querySelector('#filter-country'),
  filterYearFrom: document.querySelector('#filter-year-from'),
  filterRating: document.querySelector('#filter-rating'),
  ratingValue: document.querySelector('#rating-value'),
  resultInfo: document.querySelector('#result-info'),
  cartCount: document.querySelector('#cart-count'),
  cartBody: document.querySelector('#cart-table tbody'),
  cartMessage: document.querySelector('#cart-message'),
  filterButton: document.querySelector('#primijeni-filtere'),
  resetButton: document.querySelector('#resetiraj-filtere'),
  confirmButton: document.querySelector('#confirm-cart')
};

function init() {
  loadCart();
  elements.filterRating.addEventListener('input', updateRatingDisplay);
  elements.filterButton.addEventListener('click', (event) => {
    event.preventDefault();
    applyFilters();
  });
  elements.resetButton.addEventListener('click', (event) => {
    event.preventDefault();
    resetFilters();
  });
  elements.confirmButton.addEventListener('click', confirmCart);
  elements.tableBody.addEventListener('click', handleTableClick);
  elements.cartBody.addEventListener('click', handleCartClick);
  updateRatingDisplay();
  fetch('/movies.csv')
    .then((response) => response.text())
    .then((csv) => {
      const rawData = parseCsvObjects(csv);
      state.allFilms = rawData.map((film, index) => ({
        id: `m${index + 1}`,
        title: film.Naslov || '',
        genre: film.Zanr || '',
        year: Number(film.Godina) || 0,
        duration: Number(film.Trajanje_min) || 0,
        country: String(film.Zemlja_porijekla || '')
          .split(/[,/]+/)
          .map((c) => c.trim())
          .filter(Boolean),
        ratingValue: Number(film.Ocjena) || 0,
        ratingLabel: 'IMDb'
      }));
      if (state.allFilms.length === 0) {
        elements.resultInfo.textContent = 'Nije učitan nijedan film iz CSV datoteke.';
        return;
      }
      populateGenreFilter();
      applyFilters();
    })
    .catch((error) => {
      console.error('Greška pri dohvatu filmova:', error);
      elements.resultInfo.textContent = 'Došlo je do pogreške pri učitavanju podataka.';
    });
}

function populateGenreFilter() {
  const genres = Array.from(new Set(state.allFilms.map((film) => film.genre))).sort();
  genres.forEach((genre) => {
    const option = document.createElement('option');
    option.value = genre;
    option.textContent = genre;
    elements.filterGenre.appendChild(option);
  });
}

function updateRatingDisplay() {
  elements.ratingValue.textContent = parseFloat(elements.filterRating.value).toFixed(1);
}

function resetFilters() {
  elements.filterGenre.value = '';
  elements.filterCountry.value = '';
  elements.filterYearFrom.value = '';
  elements.filterRating.value = '0';
  updateRatingDisplay();
  applyFilters();
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let value = '';
  let insideQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && csv[i + 1] === '\n') {
        i += 1;
      }
      if (value !== '' || row.length > 0) {
        row.push(value);
        rows.push(row);
      }
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value !== '' || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function parseCsvObjects(csv) {
  const rows = parseCsvRows(csv.replace(/\r/g, '\n'));
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj;
  });
}

function applyFilters() {
  const selectedGenre = elements.filterGenre.value;
  const countrySearch = normalizeText(elements.filterCountry.value);
  const yearFrom = parseInt(elements.filterYearFrom.value, 10);
  const minRating = parseFloat(elements.filterRating.value);
  const filtersActive = Boolean(
    selectedGenre || countrySearch || !Number.isNaN(yearFrom) || minRating > 0
  );

  const filteredFilms = state.allFilms.filter((film) => {
    const genreMatch = !selectedGenre || film.genre === selectedGenre;
    const countryMatch = !countrySearch || film.country.some((c) => normalizeText(c).includes(countrySearch));
    const yearMatch = Number.isNaN(yearFrom) || film.year >= yearFrom;
    const ratingMatch = film.ratingValue >= minRating;
    return genreMatch && countryMatch && yearMatch && ratingMatch;
  });

  renderTable(filteredFilms, filtersActive);
  updateResultInfo(filteredFilms.length, filtersActive);
}

function renderTable(films, filtersActive) {
  elements.tableBody.innerHTML = '';
  const visibleFilms = films.length === 0 && !filtersActive ? state.allFilms.slice(0, 20) : films;

  if (visibleFilms.length === 0) {
    elements.tableBody.innerHTML = '<tr><td colspan="8">Nema filmova za odabrane filtere.</td></tr>';
    return;
  }

  visibleFilms.forEach((film) => {
    const row = document.createElement('tr');
    const inCart = state.cart.some((item) => item.id === film.id);
    row.innerHTML = `
      <td>${film.id}</td>
      <td>${film.title}</td>
      <td>${film.year}</td>
      <td>${film.genre}</td>
      <td>${film.duration} min</td>
      <td>${film.country.join(', ')}</td>
      <td>
        <div class="rating-cell">
          <strong>${film.ratingValue.toFixed(1)}</strong>
          <span class="rating-label">${film.ratingLabel}</span>
        </div>
      </td>
      <td>
        <button class="add-cart-button" data-film-id="${film.id}" ${inCart ? 'disabled' : ''}>
          ${inCart ? 'Već u košarici' : 'Dodaj u košaricu'}
        </button>
      </td>
    `;
    elements.tableBody.appendChild(row);
  });
}

function updateResultInfo(count, filtersActive) {
  if (count === 0) {
    if (!filtersActive) {
      elements.resultInfo.textContent = 'Prikazano je 20 najpopularnijih filmova. Koristite filtre za precizniji izbor.';
      return;
    }
    elements.resultInfo.textContent = 'Nema filmova za zadane filtere. Pokušajte s drugim kriterijima.';
    return;
  }
  elements.resultInfo.textContent = `Pronađeno filmova: ${count}.`;
}

function handleTableClick(event) {
  const button = event.target.closest('.add-cart-button');
  if (!button) {
    return;
  }
  const filmId = button.dataset.filmId;
  addFilmToCart(filmId);
}

function addFilmToCart(filmId) {
  const film = state.allFilms.find((item) => item.id === filmId);
  if (!film || state.cart.some((item) => item.id === filmId)) {
    return;
  }
  state.cart.push(film);
  saveCart();
  renderCart();
  applyFilters();
}

function handleCartClick(event) {
  if (!event.target.matches('.remove-cart-button')) {
    return;
  }
  const filmId = event.target.dataset.filmId;
  state.cart = state.cart.filter((film) => film.id !== filmId);
  saveCart();
  renderCart();
  applyFilters();
}

function renderCart() {
  elements.cartBody.innerHTML = '';
  elements.cartCount.textContent = `Odabrano filmova: ${state.cart.length}`;

  if (state.cart.length === 0) {
    elements.cartBody.innerHTML = '<tr><td colspan="4">Košarica je prazna.</td></tr>';
    elements.confirmButton.disabled = true;
    return;
  }

  state.cart.forEach((film) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${film.title}</td>
      <td>${film.year}</td>
      <td>${film.genre}</td>
      <td><button class="remove-cart-button" data-film-id="${film.id}">Ukloni</button></td>
    `;
    elements.cartBody.appendChild(row);
  });
  elements.confirmButton.disabled = false;
}

function confirmCart(event) {
  event.preventDefault();
  if (state.cart.length === 0) {
    elements.cartMessage.textContent = 'Košarica je prazna.';
    return;
  }
  const message = `Uspješno ste dodali ${state.cart.length} ${state.cart.length === 1 ? 'film' : 'filma'} u svoju košaricu za vikend maraton!`;
  elements.cartMessage.textContent = message;
  state.cart = [];
  saveCart();
  renderCart();
  applyFilters();
}

function saveCart() {
  localStorage.setItem('filmCart', JSON.stringify(state.cart));
}

function loadCart() {
  const stored = localStorage.getItem('filmCart');
  if (!stored) {
    return;
  }
  try {
    state.cart = JSON.parse(stored);
  } catch {
    state.cart = [];
  }
  renderCart();
}

document.addEventListener('DOMContentLoaded', init);