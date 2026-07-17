---
layout: ../../layouts/LayoutProjects.astro
title: "Site de Portfólio Pessoal"
description: "Um portfólio estático, rápido e otimizado construído com Astro e Markdown."
category: "Front-end"
tags: ["Astro", "Bun", "Markdown", "HTML/CSS"]
image: "https://res.cloudinary.com/dfq1bwaou/image/upload/v1784299657/175_1x_shots_so_wnunsc.png"
---

# O Projeto

Este projeto é o meu portfólio pessoal, projetado para funcionar como uma vitrine de projetos rápida, responsiva e muito fácil de manter. O objetivo principal era fugir de sistemas complexos e adotar uma abordagem limpa, onde cada novo projeto na vitrine é gerado a partir de um simples arquivo de texto.

## Funcionalidades Principais
* **Geração Estática (SSG):** O site é compilado previamente, garantindo tempos de carregamento quase instantâneos e excelente ranqueamento no Google (SEO).
* **Gerenciamento via Markdown:** Novos projetos são adicionados apenas criando um arquivo `.md` com um cabeçalho de dados (Frontmatter), sem a necessidade de um banco de dados ativo.
* **Categorização Dinâmica:** A página inicial varre a pasta de projetos e os organiza automaticamente em seções específicas (como Front-end e Game Dev).
* **Design Responsivo:** Layout fluido construído com CSS puro que se adapta perfeitamente a monitores, tablets e celulares.
* **Scroll Interativo:** Um botão flutuante inteligente que detecta a rolagem do usuário e facilita a navegação em telas longas.

## Por que escolhi essas tecnologias?
* **Astro:** Escolhido por sua performance excelente ao entregar páginas HTML puras por padrão e pelo seu suporte nativo maravilhoso para leitura de arquivos Markdown.
* **Bun:** Utilizado como *runtime* e gerenciador de pacotes devido à sua velocidade incomparável em relação ao Node.js clássico.
* **CSS Nativo:** Para manter o projeto extremamente leve, permitindo controle total sobre o design e as *media queries* de responsividade sem depender de bibliotecas externas pesadas.

---

### Código Fonte
Você pode conferir o código completo, a estrutura de pastas e as configurações de deploy deste projeto no meu repositório:

[**Acessar repositório no GitHub**](https://github.com/dam1aoGomes/portfolio)