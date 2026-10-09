# Jacks London · Controle de estoque

Sistema de estoque para Rose, Velha, Nova, Backstage, VIP e Depósito, com acesso independente para cada responsável.

## Atualização de produtos

Em Produtos, o administrador pode adicionar produtos com nome e categoria, eliminar com confirmação e restaurar produtos eliminados. Produtos eliminados ficam fora das novas contagens. Contagens já iniciadas e histórico conservam o catálogo original e as quantidades.

## Publicação existente

Endereço informado: https://jacks-london-estoque.sistemabarjacks.workers.dev

Este repositório está vinculado ao Worker existente por Cloudflare Builds. Com as compilações ativadas, alterações na branch main iniciam a publicação com npx wrangler deploy.

O arquivo wrangler.json utiliza o banco D1 existente jacks-london-estoque (85d0aa5e-9c60-4b83-89e6-a0a792e50df8), com o binding DB. Mantenha esse banco e os segredos do Worker.

Não execute npm run setup novamente, não crie outro banco e não recrie AUTH_PEPPER. A alteração desse segredo invalida a verificação das senhas existentes.

No Cloudflare Builds, deixe o comando de build vazio e use npx wrangler deploy como comando de publicação. A atualização dos produtos não requer migração do banco. Verifique o resultado em Deployments antes de considerar a atualização publicada.

## Verificação

Execute npm test. Os testes locais verificam catálogo, senhas, quantidades, datas e isolamento das áreas. O teste de integração exige um banco descartável com credenciais de teste; nunca execute contra produção.
