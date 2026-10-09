# Jacks London · Controle de estoque

Sistema de estoque para Rose, Velha, Nova, Backstage, VIP e Depósito, com acesso independente para cada responsável.

## Atualização de produtos

Em Produtos, o administrador pode adicionar produtos com nome e categoria, eliminar com confirmação e restaurar produtos eliminados. Produtos eliminados ficam fora das novas contagens. Contagens já iniciadas e histórico conservam o catálogo original e as quantidades.

## Publicação existente

Endereço informado: https://jacks-london-estoque.sistemabarjacks.workers.dev

Este repositório recupera o projeto original e incorpora a atualização dos produtos. O envio ao GitHub, por si só, não publica o sistema no Cloudflare.

O arquivo wrangler.json recuperado do pacote original contém um marcador no database_id. Antes de publicar, deve ser substituído pela configuração do Worker existente, mantendo o mesmo banco D1 e seus segredos.

Não execute npm run setup novamente, não crie outro banco e não recrie AUTH_PEPPER. A alteração desse segredo invalida a verificação das senhas existentes.

Depois de recuperar a configuração existente e autorizar o Cloudflare, instale as dependências e publique com npx wrangler deploy. A atualização não requer migração do banco.

## Verificação

Execute npm test. Os testes locais verificam catálogo, senhas, quantidades, datas e isolamento das áreas. O teste de integração exige um banco descartável com credenciais de teste; nunca execute contra produção.
