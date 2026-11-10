# StudyFlow v2

App de estudos e finanças (HTML + CSS + JS puros, sem build): tabela de estudos, provas, gastos e boletos, Pomodoro, alertas, temas e foto de fundo. Funciona no celular e no PC, instala como app (PWA) e usa o GitHub como banco **criptografado**.

## Segurança
- **Senha mestra:** pedida ao abrir. Gera uma chave AES-256-GCM (PBKDF2, 250 mil voltas) e a senha fica só na memória.
- **Local:** dados e token ficam num cofre cifrado no aparelho.
- **GitHub:** o `data.json` é texto cifrado. Mesmo que o repositório vaze, sem a senha ninguém lê. Use mesmo assim um repositório **privado**.
- **Token:** fine-grained, só no repositório de dados, permissão *Contents: Read and write*. Fica guardado cifrado no cofre.
- **Sem senha não há recuperação.** Escolha uma frase longa e guarde-a.
- O app tranca sozinho após 10 min em segundo plano (menos com o Pomodoro rodando) ou pelo botão *Trancar agora*.

## Estrutura
```
index.html  telas        css/style.css  tema (variáveis por tema)
js/app.js   lógica, comentada por seções
sw.js       offline + notificações       manifest.webmanifest + icons/  instalação
```

## Publicar e configurar
1. Envie os arquivos para um repositório e ative Settings → Pages (`main` / root).
2. Crie um repositório privado só para os dados, gere o token e preencha em **Config**.
3. Android: menu ⋮ → *Instalar app*. iPhone: Compartilhar → *Adicionar à Tela de Início*.

## Personalização (Config)
- **Tema:** neon, oceano, floresta, violeta, claro. Para criar outro, copie um bloco `[data-t=...]` do CSS.
- **Foto de fundo:** escolha da galeria; é reduzida e guardada só neste aparelho. O controle *Escurecer* melhora a leitura.
- **Sons:** sino, digital, suave ou um áudio seu (até 1,5 MB), no fim do Pomodoro e nos lembretes.

## Finanças
- **Mês a mês:** setas ‹ › trocam o mês. Cada lançamento tem tipo (despesa, boleto ou receita), categoria e data de vencimento.
- **Resumo:** receitas (salário base + receitas extras), despesas, saldo e quanto falta pagar, com barra de comprometimento e gráfico por categoria.
- **Fixos:** marque *Repete todo mês* para aluguel, internet, mensalidades etc. Eles aparecem em todos os meses seguintes e são marcados como pagos mês a mês.
- **Lista:** filtros Todos, Pendentes, Pagos e Receitas; ✓ marca como pago/recebido; tocar no item edita.
- **Exportar CSV:** baixa o mês atual para abrir no Excel ou Google Sheets.

## Alertas
Conferidos a cada 30 s: início de cada bloco de estudo, prova em até 2 dias e conta vencendo/atrasada, esta **de hora em hora entre 8h e 22h** (`HORAS_ALERTA` em `js/app.js`) até ser marcada como paga. Funcionam com o app aberto ou em segundo plano; com o app fechado seria preciso um servidor de push (o app não tem). Som e vibração dependem de o aparelho permitir; no iPhone as notificações exigem o app instalado (iOS 16.4+).

## Dados
Cifrado em `data.json`; por dentro: `{ salario, estudos:[{id,dia,ini,fim,mat,assunto}], provas:[{id,mat,data,conteudo}], contas:[{id,desc,valor,tipo,cat,venc,rec,pago,pagos,criado}] }`. Nova lista com CRUD: adicione uma entrada em `SCHEMA`, um `<div data-crud="nome">` e a chave em `DB`.
