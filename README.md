StudyFlow v2
App de estudos e finanças (HTML + CSS + JS puros, sem build): tabela de estudos, provas, gastos e boletos, Pomodoro, alertas, temas e foto de fundo. Funciona no celular e no PC, instala como app (PWA) e usa o GitHub como banco criptografado.
Segurança
Senha mestra: pedida ao abrir. Gera uma chave AES-256-GCM (PBKDF2, 250 mil voltas) e a senha fica só na memória.
Local: dados e token ficam num cofre cifrado no aparelho.
GitHub: o `data.json` é texto cifrado. Mesmo que o repositório vaze, sem a senha ninguém lê. Use mesmo assim um repositório privado.
Token: fine-grained, só no repositório de dados, permissão Contents: Read and write. Fica guardado cifrado no cofre.
Sem senha não há recuperação. Escolha uma frase longa e guarde-a.
Manter aberto neste aparelho (marcado por padrão): guarda a chave (não a senha) no navegador, como chave não exportável, e recarregar a página não pede senha. Quem usar seu navegador desbloqueado consegue abrir o app, então mantenha a tela do celular protegida. O GitHub continua só com texto cifrado. Trancar agora apaga a chave e volta a pedir a senha. Desmarcando a opção, o app pede a senha ao abrir e tranca sozinho após 10 min em segundo plano.
Como o banco funciona
Não há servidor de banco de dados. O app usa duas cópias dos mesmos dados:
Local: um cofre cifrado no navegador do aparelho (abre offline).
Nuvem: o arquivo `data.json` no seu repositório, lido e gravado pela API do GitHub com o seu token. O conteúdo é cifrado antes de sair do aparelho.
Ao abrir, o app lê o `data.json`, decifra e usa como dado atual. A cada alteração ele salva o cofre local e, 1,5 s depois, grava o arquivo (um commit), então o histórico de commits serve de backup. Limite atual: vale a última gravação; editar em dois aparelhos ao mesmo tempo pode sobrescrever o outro.
Estrutura
```
index.html  telas        css/style.css  tema (variáveis por tema)
js/app.js   lógica, comentada por seções
sw.js       offline + notificações       manifest.webmanifest + icons/  instalação
```
Publicar e configurar
Envie os arquivos para um repositório e ative Settings → Pages (`main` / root).
Crie um repositório privado só para os dados, gere o token e preencha em Config.
Android: menu ⋮ → Instalar app. iPhone: Compartilhar → Adicionar à Tela de Início.
Personalização (Config)
Tema: neon, oceano, floresta, violeta, claro. Para criar outro, copie um bloco `\\\[data-t=...]` do CSS.
Foto de fundo: escolha da galeria; é reduzida e guardada só neste aparelho. O controle Escurecer melhora a leitura.
Sons: sino, digital, suave ou um áudio seu (até 1,5 MB), no fim do Pomodoro e nos lembretes.
Finanças
Mês a mês: setas ‹ › trocam o mês. Cada lançamento tem tipo (despesa, boleto ou receita), categoria e data de vencimento.
Resumo: receitas (salário base + receitas extras), despesas, saldo e quanto falta pagar, com barra de comprometimento e gráfico por categoria.
Fixos: marque Repete todo mês para aluguel, internet, mensalidades etc. Eles aparecem em todos os meses seguintes e são marcados como pagos mês a mês.
Lista: filtros Todos, Pendentes, Pagos e Receitas; ✓ marca como pago/recebido; tocar no item edita.
Exportar CSV: baixa o mês atual para abrir no Excel ou Google Sheets.
Alertas
Conferidos a cada 30 s: início de cada bloco de estudo, prova em até 2 dias e conta vencendo/atrasada, esta de hora em hora entre 8h e 22h (`HORAS\\\_ALERTA` em `js/app.js`) até ser marcada como paga. Funcionam com o app aberto ou em segundo plano; com o app fechado seria preciso um servidor de push (o app não tem). Som e vibração dependem de o aparelho permitir; no iPhone as notificações exigem o app instalado (iOS 16.4+).
Dados
Cifrado em `data.json`; por dentro: `{ salario, estudos:\\\[{id,dia,ini,fim,mat,assunto}], provas:\\\[{id,mat,data,conteudo}], contas:\\\[{id,desc,valor,tipo,cat,venc,rec,pago,pagos,criado}] }`. Nova lista com CRUD: adicione uma entrada em `SCHEMA`, um `<div data-crud="nome">` e a chave em `DB`.
