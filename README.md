# Portfólio pessoal — 100% estático

Site de portfólio em **HTML, CSS e JavaScript puro**, sem build e sem back-end.
Todo o conteúdo vem de arquivos **Markdown** na pasta `content/` — você nunca
precisa editar o `index.html`.

```
index.html                 estrutura da página
assets/css/style.css       estilos + os 9 temas
assets/js/app.js           lê os .md, renderiza tudo, temas e efeitos
assets/img/                imagens dos projetos
content/site.md            nome, tagline, tema padrão e links
content/bio.md             texto da seção "Sobre"
content/projects.md        seus projetos
.nojekyll                  desliga o Jekyll no GitHub Pages
```

## 1. Adicionar um projeto

Abra `content/projects.md` e copie um bloco inteiro:

```markdown
## Nome do projeto
- tipo: site
- status: online
- tags: HTML, CSS, JavaScript
- imagem: assets/img/meu-projeto.png
- demo: https://exemplo.com
- repo: https://github.com/usuario/repo
- destaque: sim

Descrição em **Markdown**: pode ter listas, links, `código` e citações.
```

- Cada projeto **começa** com uma linha `## `.
- Os `- chave: valor` logo abaixo são metadados (opcionais).
- Tudo o que vier depois é a descrição.
- `tipo` é livre (`site`, `jogo`, `app`…): vira o rótulo e o filtro.
- `status`: `online` → `✓ online`, `em andamento` → `● em andamento`,
  `arquivado` → `○ arquivado`.
- `destaque: sim` deixa o card maior.
- `tags` separadas por vírgula viram chips e filtros.
- Sem `demo` ou `repo`, o botão correspondente simplesmente não aparece.

## 2. Mudar a bio e os dados do site

- **Sobre:** edite `content/bio.md` (Markdown livre).
- **Nome, tagline, links:** edite `content/site.md`:

```yaml
nome: Seu Nome
tagline: Desenvolvedor de sites, apps e jogos
tema: auto          # auto = seguir o sistema; ou: dark, light, dracula,
                    # nord, gruvbox, solarized, tokyo-night, min-dark, min-light
github: https://github.com/seu-usuario
email: oi@exemplo.com
```

## 3. Adicionar imagens

Coloque o arquivo em `assets/img/` (PNG, JPG, WebP ou SVG) e referencie no
projeto com caminho **relativo**:

```markdown
- imagem: assets/img/meu-projeto.png
```

Se a imagem não existir, o card só fica sem imagem — nada quebra.

## 4. Publicar no GitHub Pages

1. Suba os arquivos para um repositório no GitHub (`main`).
2. Vá em **Settings → Pages**.
3. Em **Source**, escolha **Deploy from a branch**.
4. Selecione a branch `main` e a pasta **/ (root)**. Salve.
5. Espere alguns minutos e acesse `https://usuario.github.io/repositorio/`.

Todos os caminhos são relativos, então funciona em subpasta. O `.nojekyll` já
está incluído (o Jekyll ignoraria arquivos/pastas começando com `_`).

## 5. Testar localmente

Abrir o `index.html` direto pelo disco (`file://`) **não funciona**: o navegador
bloqueia o `fetch()` de arquivos locais. Rode um servidor simples na pasta do
projeto:

```bash
python -m http.server 8000
```

Depois abra <http://localhost:8000>. (Também funciona `npx serve` ou
`php -S localhost:8000`.) No GitHub Pages não precisa de nada disso.

## Dicas

- Temas: clique em um tema ou pressione <kbd>T</kbd> para alternar claro/escuro.
  A escolha fica salva no `localStorage`.
- O Markdown é renderizado com `marked` e sanitizado com `DOMPurify` (CDN com
  versão fixa). O HTML escrito nos `.md` é permitido, mas scripts são removidos.
- Para trocar o favicon, edite a `<link rel="icon">` do `index.html`.

Feito com HTML, CSS e Markdown.
