# Custo do documento único

## Medição reproduzível

```sh
npm run benchmark:state -- --output=docs/state-benchmark.json
```

Também é possível escolher tamanhos e repetições, por exemplo `npm run benchmark:state -- --sizes=100,1000,5000 --samples=7`. O comando utiliza dados sintéticos, SQLite local e requisições HTTP reais ao mesmo handler da aplicação. Cada tamanho usa um processo e um banco temporário próprios; nenhum banco existente é aberto e nenhuma variável de acesso ao Turso é usada. Os processos terminam antes da remoção dos arquivos, evitando locks do SQLite no Windows.

São feitas uma gravação de aquecimento e sete gravações medidas. Em cada gravação muda apenas o campo `paid` de um registro, mas o documento completo percorre o PUT, a validação e o histórico transacional. Um GET após cada gravação verifica a quantidade de registros e mede leitura, transferência e interpretação do JSON. Também são medidos separadamente a serialização e a validação pura. Os resultados completos e o ambiente estão em [state-benchmark.json](state-benchmark.json).

## Resultado local em 16/10/2026

Windows x64, Node v24.18.0, Intel Core i5-10210U. Tempos são medianas locais; não representam a latência do Turso, Vercel ou de um celular.

| Lançamentos | Corpo enviado | PUT local | GET local | 30 versões completas, estimativa |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 25,4 KiB | 20,8 ms | 11,6 ms | 0,74 MiB |
| 1.000 | 254,5 KiB | 19,8 ms | 20,6 ms | 7,46 MiB |
| 5.000 | 1.280,3 KiB | 68,7 ms | 43,8 ms | 37,51 MiB |
| 10.000 | 2.562,6 KiB | 124,2 ms | 67,9 ms | 75,08 MiB |
| 20.000 | 5.146,7 KiB | 211,5 ms | 114,7 ms | 150,78 MiB |

O tamanho das 30 versões é calculado a partir do documento; não inclui índices, tabelas de sessões, páginas SQLite ou overhead do banco. A execução grava nove versões por tamanho, incluindo o estado vazio inicial, e registra separadamente os bytes realmente armazenados nesses backups. Diferenças de cache e do sistema explicam por que um ensaio maior pode apresentar tempo menor; estes números não constituem uma curva garantida de latência.

Os 20.000 registros sintéticos ultrapassam o limite de 4 MiB adotado pela aplicação na Vercel; a medição usa o handler tradicional de 10 MiB. O número exato de lançamentos suportados depende do tamanho dos textos e metadados. Como estimativa de transporte, enviar 1,25 MiB por uma conexão de upload de 10 Mbps consumiria aproximadamente 1,05 segundo, antes de latência, criptografia e processamento. Não foi realizado um teste de rede remota.

## Decisão e próximo passo

A refatoração da interface não altera o banco, os backups nem o contrato de revisões. Não há dados de volume ou latência de produção nesta avaliação; portanto, o benchmark sozinho não demonstra necessidade de migrar o uso atual.

Para poucos registros, o documento único mantém a implementação simples. Uma migração por lançamento passa a ter prioridade se houver conflitos frequentes entre dispositivos, latência de gravação perceptível no uso real ou aproximação do limite de payload. Como critério conservador de planejamento, revisar o modelo quando o documento atingir cerca de 1 MiB, deixando margem para a evolução antes de 4 MiB; esse é um critério proposto, não um limite medido do banco.

Uma migração futura deve reunir: tabela por lançamento e conta; operações GET/POST/PATCH/DELETE com identidade derivada da sessão; controle de concorrência por registro; gravação transacional de parcelas e recorrências; histórico recuperável e importação/exportação compatíveis. Trocar apenas PUT por PATCH sem mudar a persistência continuaria regravando o histórico inteiro no banco. A migração deve ser validada com isolamento entre contas, alterações concorrentes, rollback, restauração e compatibilidade dos backups antigos.
