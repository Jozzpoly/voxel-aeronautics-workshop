(() => {
  'use strict';

  window.VAW.define('game.career-service', ['foundation.config', 'foundation.catalog'], (Config, Catalog) => {
    const { CAREER_SAVE_KEY, CAREER_SAVE_VERSION } = Config;
    const { CONTRACTS } = Catalog;

    function clamp(value, minimum, maximum) {
      return Math.min(maximum, Math.max(minimum, value));
    }

    function create({ state, storage = window.localStorage } = {}) {
      if (!state?.career) throw new TypeError('Career service requires application state.');

      function getContractById(id) { return Catalog.getContractById(id); }
      function knownContractIds() { return Catalog.knownContractIds(); }
      function isContractUnlocked(contract) {
        return Boolean(contract) && (!contract.prerequisite || Boolean(state.career.completed[contract.prerequisite]));
      }
      function getSelectedContract() {
        const selected = getContractById(state.career.selectedContractId);
        const fallback = CONTRACTS.find(contract => contract.id === 'hover_license') || CONTRACTS[0] || null;
        if (!fallback) throw new Error('Contract catalog is empty.');
        return isContractUnlocked(selected) ? selected : fallback;
      }
      function normalizeCareerData(data) {
        const source = data && typeof data === 'object' ? data : {};
        const validIds = knownContractIds();
        const completed = {};
        const best = {};
        for (const contract of CONTRACTS) {
          if (contract.id === 'sandbox') continue;
          if (source.completed?.[contract.id] === true) completed[contract.id] = true;
          const rawBest = source.best?.[contract.id];
          if (!rawBest || typeof rawBest !== 'object') continue;
          const stars = clamp(Math.round(Number(rawBest.stars) || 0), 0, 3);
          const time = Math.max(0, Number(rawBest.time) || 0);
          const fuelFraction = clamp(Number(rawBest.fuelFraction) || 0, 0, 1);
          const integrity = clamp(Number(rawBest.integrity) || 0, 0, 100);
          if (stars > 0 && Number.isFinite(time)) best[contract.id] = { stars, time, fuelFraction, integrity };
        }
        const selectedContractId = typeof source.selectedContractId === 'string' && validIds.has(source.selectedContractId)
          ? source.selectedContractId
          : 'hover_license';
        const normalized = {
          credits: clamp(Number(source.credits) || 0, 0, 1_000_000_000),
          selectedContractId,
          completed,
          best,
          totalStars: 0
        };
        const selected = getContractById(selectedContractId);
        if (!selected || (selected.prerequisite && !completed[selected.prerequisite])) normalized.selectedContractId = 'hover_license';
        normalized.totalStars = Object.values(best).reduce((sum, result) => sum + result.stars, 0);
        return normalized;
      }
      function careerRank() {
        const completedCount = CONTRACTS.filter(contract => contract.id !== 'sandbox' && state.career.completed[contract.id] === true).length;
        if (completedCount >= 8) return 'Chief Test Engineer';
        if (completedCount >= 6) return 'Range Commander';
        if (completedCount >= 4) return 'Senior Aeronaut';
        if (completedCount >= 2) return 'Flight Engineer';
        if (completedCount >= 1) return 'Licensed Apprentice';
        return 'Apprentice Engineer';
      }
      function recalculateCareerStars() {
        state.career.totalStars = CONTRACTS.reduce((sum, contract) => sum + Math.max(0, Number(state.career.best[contract.id]?.stars) || 0), 0);
      }
      function loadCareer() {
        try {
          const raw = storage.getItem(CAREER_SAVE_KEY);
          if (!raw) return;
          Object.assign(state.career, normalizeCareerData(JSON.parse(raw)));
        } catch (error) {
          console.warn('Career save could not be loaded:', error);
          Object.assign(state.career, normalizeCareerData(null));
        }
      }
      function saveCareer() {
        try {
          Object.assign(state.career, normalizeCareerData(state.career));
          storage.setItem(CAREER_SAVE_KEY, JSON.stringify({
            version: CAREER_SAVE_VERSION,
            credits: state.career.credits,
            selectedContractId: state.career.selectedContractId,
            completed: state.career.completed,
            best: state.career.best
          }));
        } catch (error) {
          console.warn('Career save could not be written:', error);
        }
      }

      return Object.freeze({
        getContractById, knownContractIds, isContractUnlocked, getSelectedContract,
        normalizeCareerData, careerRank, recalculateCareerStars, loadCareer, saveCareer
      });
    }

    return Object.freeze({ create });
  });
})();
