# Access Hub

Estou construindo uma plataforma interna com React + Tailwind + Supabase. O

banco JÁ está criado no Supabase conectado a este projeto: existem as tabelas

organizations, memberships e profiles, a função is_member(org_id) e um gatilho

que cria a empresa da pessoa no primeiro acesso (com ela como 'dono'). NÃO

recrie tabelas, NÃO altere o schema, NÃO crie novas políticas de RLS.

Construa APENAS a camada de acesso, sem nenhum módulo:

- Login por e-mail e senha usando Supabase Auth.

- Recuperação de senha funcionando de verdade: link de redefinição por e-mail

  e tela para definir a nova senha.

- Cadastro (signup) pedindo nome completo e enviando esse nome em

  raw_user_meta_data.full_name (o gatilho do banco usa esse campo).

- Depois de entrar, uma área autenticada mínima, ainda SEM menu de módulos,

  mostrando o nome da empresa da pessoa (leia de organizations através de

  memberships) e o papel dela.

- Tela "Minha conta": editar o nome, trocar a senha e sair. (O campo de foto

  pode ficar só visualmente por enquanto.)

- Proteja as rotas: sem sessão ativa, a pessoa cai na tela de login.

- Não use nenhum PIN nem verificação feita no navegador como segurança — o

  acesso já é garantido pelo RLS no banco.

Ainda NÃO crie módulos (nada de tarefas, dinheiro ou arquivos). Pare quando a

base de acesso estiver funcionando de ponta a ponta.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/53ecd1a3-3a59-4038-b310-78fb5c10eaf7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
