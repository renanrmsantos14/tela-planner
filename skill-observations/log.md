# Skill observations

### Observation 3: CSS responsivo não reduz árvore React

**Status:** OPEN
**Date:** 2026-08-24
**Session context:** Auditoria de uso mobile do Tela Planner.
**Skill:** smart-explore / playwright
**Type:** open-source
**Phase/Area:** Performance e responsividade

**Issue:** O quadro desktop e a lista mobile renderizam os mesmos cartões simultaneamente, e o breakpoint apenas oculta uma das árvores com CSS. A inspeção real mostrou contagens iguais nas duas árvores mesmo quando uma estava invisível.

**Suggested improvement:** Em interfaces responsivas com árvores de conteúdo grandes, escolher a variante por breakpoint/runtime e renderizar apenas a árvore ativa; usar CSS apenas para diferenças visuais locais.

**Principle:** Ocultar uma árvore responsiva com CSS não elimina o custo de renderização nem a complexidade de interação.
