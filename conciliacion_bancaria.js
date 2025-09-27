const session_id = LibOdooUtils.odooGetSessionId('EZ');

function startProcessBankReconciliation() {
  try {
  
    const ui = SpreadsheetApp.getUi();

    const response = ui.prompt(
      'Conciliación bancaria', // Título del popup
      'Por favor, ingrese los 4 últimos dígitos del diario por le que desea filtrar:', // Mensaje del popup
      ui.ButtonSet.OK_CANCEL // Botones: "Aceptar" y "Cancelar"
    );

    if (response.getSelectedButton() == ui.Button.OK_CANCEL) {
      let message = "Operación cancelada por el usuario."
      SpreadsheetApp.getActiveSpreadsheet().toast(message, "Estado", -1);
      return
    }

    let diario = response.getResponseText()

    // Si viene con información
    if (!diario) {
      let message = "Operación cancelada por el usuario."
      SpreadsheetApp.getActiveSpreadsheet().toast(message, "Estado", -1);
      throw new Error('Advertencia: No has introducido ningun diario. La operación ha sido cancelada.');
    }

    Logger.log(`let Diario: ${diario}`)
    //let diario = "2419"

    //Se obtiene todas las conciliaciones vista contabilidad
    const dataToReconciliation = getAccountJournals(diario);

    LibSheetUtils.UI_showStatus(
      `Se encontraron las cuentas ${dataToReconciliation.map(i => i.name).join(", ")}`
    )
    Logger.log(`Se encontraron las cuentas: ${dataToReconciliation.map(i => i.name).join(", ")}.`)

    let outPutConciliados = []
    let outPutNoConciliados = []
    try {
      for (let conciliation of dataToReconciliation) {

        LibSheetUtils.UI_showStatus(
          `${conciliation.number_to_reconcile} por conciliar en la cuenta ${conciliation.name}`
          )
        Logger.log(`Iterando sobre la cuenta: \n${JSON.stringify(conciliation)}`)

        /** Consulta por las cuentas por cruzar */
        const objJournal = getDataOfJournal(conciliation.id);

        Logger.log(`Cuentas por crusar: ${objJournal.map(j => ([j.payment_ref, j.amount])).join("; ")}`)

        LibSheetUtils.UI_showStatus(
          `Se estan conciliando los asientos de la agrupación ${conciliation.name}`
        )

        for (let journal of objJournal) {
          Logger.log(`Journal en turno: ${journal.payment_ref} ; ${journal.amount} ; ${journal.date}`)

          if(journal.amount != -1442470) continue;

          const existingEntries = getAccountMoveLine(journal, conciliation);

          if (existingEntries.length == 0) {
            outPutNoConciliados.push({
              ID_Agrupacion: conciliation.id,
              Nombre_Agrupacion: conciliation.name,
              ID_AsientoContable: journal?.id,
              NombreAsociado: journal?.display_name,
              Valor: journal?.amount,
              mensaje: "No se encontró cuenta para conciliar",
              TimeStam: Utilities.formatDate(new Date, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm")
            })

            Logger.log(`El asiento contable ${journal.display_name} no tiene una cuenta para conciliar de la cuenta ${conciliation.id}.`);

            LibSheetUtils.UI_showStatus(
              `El asiento contable ${journal.display_name} no tiene una cuenta para conciliar de la cuenta ${conciliation.id}.`
            )

          } else {
            /**
             * Modificación del journal para poder hacer la conciliación
             */
            const pareja = existingEntries[0];

            journal.lineIds[1][2].source_aml_id = pareja.id;
            journal.lineIds[1][2].source_aml_move_id = pareja.move_id.id;
            journal.lineIds[1][2].source_aml_move_name = pareja.move_id.display_name.split(" ")[0];
            journal.lineIds[1][2].source_aml_move_name = pareja.move_id.display_name.split(" ")[0];
            journal.lineIds[1][2].account_id = pareja.account_id.id;


            journal.selected_aml_ids = [
                    [
                        4,
                        journal.selected_aml_ids[0][1]
                    ],
                    [
                        4,
                        existingEntries[0].id
                    ]
                ]

            toMakeConciliation(journal);
            Logger.log(`Se ha conciliado el asiento ${journal.display_name} con id ${journal?.id} de la cuenta ${conciliation.id}.`);

            LibSheetUtils.UI_showStatus(
              `Se ha conciliado el asiento ${journal.display_name} con id ${journal?.id} de la cuenta ${conciliation.id}.`
            )


            Logger.log("Enviando a Output.")
            outPutConciliados.push({
              ID_Agrupacion: conciliation.id,
              Nombre_Agrupacion: conciliation.name,
              ID_AsientoContable: journal?.id,
              NombreAsociado: journal?.display_name,
              Valor: journal?.amount,
              mensaje: "Se ha consiliado con éxito",
              TimeStam: Utilities.formatDate(new Date, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm")
            })
          }

        }
      }
    }
    finally {
      Logger.log("Entrando al finally.")

      LibSheetUtils.jsonToSheet(
        outPutConciliados,
        "Conciliados",
        true)
      LibSheetUtils.jsonToSheet(
        outPutNoConciliados,
        "NO conciliados",
        true)
    }
  }
  catch (error) {
    throw new Error(`Error: ${error.message}`)
  }
}

function toMakeConciliation(journal) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "bank.rec.widget",
      "method": "onchange",
      "args": [
        [],
        {
          "st_line_id": journal?.id,
          "move_id": journal?.move_id,
          "st_line_to_check": false,
          "st_line_is_reconciled": false,
          "st_line_journal_id": journal?.journal_id ?? false,
          "st_line_narration": false,
          "st_line_transaction_details": false,
          "transaction_currency_id": journal?.currency_id,
          "journal_currency_id": journal?.currency_id,
          "partner_id": journal?.partner_id,
          "line_ids": journal?.lineIds,
          "available_reco_model_ids": [],
          "selected_reco_model_id": false,
          "partner_name": false,
          "company_id": journal?.company_id,
          "company_currency_id": journal?.currency_id,
          "matching_rules_allow_auto_reconcile": true,
          "state": "valid",
          "is_multi_currency": true,
          "selected_aml_ids": journal.selected_aml_ids,
          "todo_command": {
            "method_name": "validate"
          },
          "return_todo_command": false,
          "form_index": false,
          "display_name": false,
          "selected_batch_payment_ids": [],
          "matched_sale_order_ids": []
        },
        [
          "todo_command"
        ],
        {
          "st_line_id": {
            "fields": {
              "display_name": {}
            }
          },
          "move_id": {
            "fields": {
              "display_name": {}
            }
          },
          "st_line_to_check": {},
          "st_line_is_reconciled": {},
          "st_line_journal_id": {
            "fields": {
              "display_name": {}
            }
          },
          "st_line_narration": {},
          "st_line_transaction_details": {},
          "transaction_currency_id": {
            "fields": {
              "display_name": {}
            }
          },
          "journal_currency_id": {
            "fields": {
              "display_name": {}
            }
          },
          "partner_id": {
            "fields": {
              "display_name": {}
            }
          },
          "line_ids": {},
          "available_reco_model_ids": {
            "fields": {
              "id": {},
              "display_name": {}
            }
          },
          "selected_reco_model_id": {
            "fields": {
              "display_name": {}
            }
          },
          "partner_name": {},
          "company_id": {
            "fields": {
              "display_name": {}
            }
          },
          "company_currency_id": {
            "fields": {
              "display_name": {}
            }
          },
          "matching_rules_allow_auto_reconcile": {},
          "state": {},
          "is_multi_currency": {},
          "selected_aml_ids": {},
          "todo_command": {},
          "return_todo_command": {},
          "form_index": {},
          "id": {},
          "display_name": {},
          "selected_batch_payment_ids": {},
          "matched_sale_order_ids": {}
        }
      ],
      "kwargs": {}
    }
  }

  const makeConciliation = consumeEndpoint(payload, 'web/dataset/call_kw/bank.rec.widget/onchange');

}

function getAccountJournals(diario) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.journal",
      "method": "web_search_read",
      "args": [],
      "kwargs": {
        "specification": {
          "id": {},
          "name": {},
          "type": {},
          "kanban_dashboard": {}
        },
        "limit": 1000,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "uid": 14,
          "allowed_company_ids": [1, 2, 3, 4]
        },
        "count_limit": 10001,
        "domain": ["&", ["show_on_dashboard", "=", true],
          "|",
          ["type", "=", "cash"],
          ["type", "=", "bank"],
          "|",
          ["name", "ilike", diario],
          ["code", "ilike", diario]
        ]
      }
    }
  }

  const accountJournal = consumeEndpoint(payload, 'web/dataset/call_kw/account.journal/web_search_read');
  const dataToReconciliation = [];
  accountJournal?.records.forEach(item => {
    const kanbanData = JSON.parse(item.kanban_dashboard);
    if (kanbanData.number_to_reconcile > 0) {
      dataToReconciliation.push({
        id: item.id,
        name: item.name,
        type: item.type,
        number_to_reconcile: kanbanData.number_to_reconcile,
      })
    }
  });
  return dataToReconciliation;
}

function test(){
  Logger.log(JSON.stringify( getAccountJournalId('Davivienda 0550108900637860')))
}

function getAccountJournalId(diario) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.journal",
      "method": "web_search_read",
      "args": [],
      "kwargs": {
        "specification": {
          "id": {},
          "name": {},
          "type": {},
          "kanban_dashboard": {}
        },
        "limit": 1000,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "uid": 14,
          "allowed_company_ids": [1, 2, 3, 4]
        },
        "count_limit": 10001,
        "domain": ["&", ["show_on_dashboard", "=", true],
          "|",
          ["type", "=", "cash"],
          ["type", "=", "bank"],
          "|",
          ["name", "ilike", diario],
          ["code", "ilike", diario]
        ]
      }
    }
  }

  const accountJournal = consumeEndpoint(payload, 'web/dataset/call_kw/account.journal/web_search_read');
  
  return accountJournal?.records[0]?.id ;
}

function getDataOfJournal(id) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.bank.statement.line",
      "method": "web_search_read",
      "args": [],
      "kwargs": {
        "specification": {
          "id": {},
          "state": {},
          "statement_balance_end_real": {},
          "statement_name": {},
          "company_id": {
            "fields": {
              "display_name": {}
            }
          },
          "journal_id": {
            "fields": {
              "display_name": {}
            }
          },
          "statement_id": {
            "fields": {
              "display_name": {}
            }
          },
          "is_reconciled": {},
          "to_check": {},
          "partner_bank_id": {
            "fields": {
              "display_name": {}
            }
          },
          "currency_id": {
            "fields": {
              "display_name": {}
            }
          },
          "date": {},
          "partner_id": {
            "fields": {
              "display_name": {}
            }
          },
          "amount": {},
          "payment_ref": {}
        },
        "offset": 0,
        "order": "",
        "limit": 200,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "uid": 14,
          "allowed_company_ids": [1, 2, 3, 4],
          "bin_size": true,
          "active_model": "account.journal"
        },
        "count_limit": 10001,
        "domain": ["&", ["state", "!=", "cancel"],
          "&",
          ["journal_id", "=", id],
          "&",
          ["is_reconciled", "=", false],
          ["to_check", "=", false]
        ]
      }
    }
  }
  const journalData = consumeEndpoint(payload, 'web/dataset/call_kw/account.bank.statement.line/web_search_read');

  const journalInfo = [];
  let cont = 0;
  for (journal of journalData.records) {
    const bankRec = getBankRec(journal.id, journal.partner_id?.id, journal.amount, journal.date);
    const lineIds = [];
    for (const line_ids of bankRec.line_ids) {
      const data = {
        analytic_distribution: line_ids[2]?.analytic_distribution == undefined ? 0 : line_ids[2]?.analytic_distribution,
        analytic_distribution_search: line_ids[2]?.analytic_distribution_search == undefined ? 0 : line_ids[2]?.analytic_distribution_search,
        analytic_precision: 2,
        index: line_ids[2]?.index,
        flag: line_ids[2]?.flag,
        journal_default_account_id: line_ids[2]?.journal_default_account_id.id,
        account_id: line_ids[2]?.account_id.id,
        date: line_ids[2]?.date,
        name: line_ids[2]?.name,
        partner_id: line_ids[2]?.partner_id.id,
        currency_id: line_ids[2]?.currency_id.id,
        company_id: line_ids[2]?.company_id.id,
        company_currency_id: line_ids[2]?.company_currency_id.id,
        amount_currency: line_ids[2]?.amount_currency,
        balance: line_ids[2]?.balance,
        transaction_currency_id: line_ids[2]?.transaction_currency_id,
        amount_transaction_currency: 0,
        debit: 0,
        credit: line_ids[2]?.credit,
        force_price_included_taxes: line_ids[2]?.force_price_included_taxes,
        tax_base_amount_currency: 0,
        source_aml_id: line_ids[2]?.source_aml_id.id,
        source_aml_move_id: line_ids[2]?.source_aml_move_id.id == undefined ? 0 : line_ids[2]?.source_aml_move_id,
        source_aml_move_name: line_ids[2]?.source_aml_move_name == undefined ? 0 : line_ids[2]?.source_aml_move_name,
        tax_repartition_line_id: line_ids[2]?.tax_repartition_line_id == undefined ? 0 : line_ids[2]?.tax_repartition_line_id,
        group_tax_id: line_ids[2]?.group_tax_id == undefined ? 0 : line_ids[2]?.group_tax_id,
        reconcile_model_id: line_ids[2]?.reconcile_model_id == undefined ? 0 : line_ids[2]?.reconcile_model_id,
        source_amount_currency: line_ids[2]?.source_amount_currency == undefined ? 0 : line_ids[2]?.source_amount_currency,
        source_balance: line_ids[2]?.source_balance == undefined ? 0 : line_ids[2]?.source_balance,
        source_debit: line_ids[2]?.source_debit == undefined ? 0 : line_ids[2]?.source_debit,
        source_credit: line_ids[2]?.source_credit == undefined ? 0 : line_ids[2]?.source_credit,
        source_rate: line_ids[2]?.source_rate == undefined ? 0 : line_ids[2]?.source_rate,
        display_stroked_amount_currency: line_ids[2]?.display_stroked_amount_currency,
        display_stroked_balance: line_ids[2]?.display_stroked_balance,
        partner_currency_id: line_ids[2]?.partner_currency_id,
        partner_receivable_account_id: line_ids[2]?.partner_receivable_account_id,
        partner_payable_account_id: line_ids[2]?.partner_payable_account_id,
        partner_receivable_amount: line_ids[2]?.partner_receivable_amount,
        partner_payable_amount: line_ids[2]?.partner_payable_amount,
        bank_account: line_ids[2]?.bank_account,
        suggestion_html: line_ids[2]?.suggestion_html,
        suggestion_amount_currency: line_ids[2]?.suggestion_amount_currency,
        suggestion_balance: line_ids[2]?.suggestion_balance,
        ref: line_ids[2]?.ref,
        narration: line_ids[2]?.narration,
        manually_modified: line_ids[2]?.manually_modified,
        display_name: line_ids[2]?.display_name,
        source_batch_payment_id: line_ids[2]?.source_batch_payment_id
      }
      lineIds.push([0, `virtual_${data?.account_id}`, data]);
    }
    journalInfo.push({
      id: journal.id,
      state: journal.state,
      currency_id: journal.currency_id?.id,
      company_id: journal.company_id?.id,
      partner_id: journal.partner_id?.id,
      journal_id: journal.journal_id?.id,
      display_name: journal.partner_id?.display_name,
      amount: journal.amount,
      payment_ref: journal.payment_ref,
      date: journal.date,
      move_id: bankRec.move_id,
      domain: bankRec.domain,
      selected_aml_ids: bankRec.selected_aml_ids,
      line_ids: bankRec.line_ids,
      lineIds: lineIds,
    });
    cont++;
  }
  return journalInfo;
}

function getBankRec(id, partner_id, amount, date) {
  const typeAccount = amount < 0 ? ["account_id", "ilike", "Pagos Pendientes"] : ["account_id", "ilike", "Recibos Pendientes"];
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "bank.rec.widget",
      "method": "onchange",
      "args": [
        [],
        {
          "st_line_id": false,
          "move_id": false,
          "st_line_to_check": false,
          "st_line_is_reconciled": false,
          "st_line_journal_id": false,
          "st_line_narration": false,
          "st_line_transaction_details": false,
          "transaction_currency_id": false,
          "journal_currency_id": false,
          "partner_id": false,
          "line_ids": [],
          "available_reco_model_ids": [],
          "selected_reco_model_id": false,
          "partner_name": false,
          "company_id": false,
          "company_currency_id": false,
          "matching_rules_allow_auto_reconcile": false,
          "state": false,
          "is_multi_currency": false,
          "selected_aml_ids": [],
          "todo_command": {
            "method_name": "mount_st_line",
            "args": [id]
          },
          "return_todo_command": false,
          "form_index": false,
          "display_name": false,
          "selected_batch_payment_ids": [],
          "matched_sale_order_ids": []
        },
        [
          "todo_command"
        ],
        {
          "st_line_id": {
            "fields": {
              "display_name": {}
            }
          },
          "move_id": {
            "fields": {
              "display_name": {}
            }
          },
          "st_line_to_check": {},
          "st_line_is_reconciled": {},
          "st_line_journal_id": {
            "fields": {
              "display_name": {}
            }
          },
          "st_line_narration": {},
          "st_line_transaction_details": {},
          "transaction_currency_id": {
            "fields": {
              "display_name": {}
            }
          },
          "journal_currency_id": {
            "fields": {
              "display_name": {}
            }
          },
          "partner_id": {
            "fields": {
              "display_name": {}
            }
          },
          "line_ids": {
            "fields": {
              "analytic_distribution": {},
              "analytic_distribution_search": {},
              "analytic_precision": {},
              "distribution_analytic_account_ids": {
                "fields": {
                  "id": {},
                  "display_name": {}
                }
              },
              "index": {},
              "flag": {},
              "journal_default_account_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "account_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "date": {},
              "name": {},
              "partner_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "currency_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "company_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "company_currency_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "amount_currency": {},
              "balance": {},
              "transaction_currency_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "amount_transaction_currency": {},
              "debit": {},
              "credit": {},
              "force_price_included_taxes": {},
              "tax_base_amount_currency": {},
              "source_aml_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "source_aml_move_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "source_aml_move_name": {},
              "tax_repartition_line_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "tax_ids": {
                "fields": {
                  "id": {},
                  "display_name": {}
                }
              },
              "tax_tag_ids": {
                "fields": {
                  "id": {},
                  "display_name": {}
                }
              },
              "group_tax_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "reconcile_model_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "source_amount_currency": {},
              "source_balance": {},
              "source_debit": {},
              "source_credit": {},
              "source_rate": {},
              "display_stroked_amount_currency": {},
              "display_stroked_balance": {},
              "partner_currency_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "partner_receivable_account_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "partner_payable_account_id": {
                "fields": {
                  "display_name": {}
                }
              },
              "partner_receivable_amount": {},
              "partner_payable_amount": {},
              "bank_account": {},
              "suggestion_html": {},
              "suggestion_amount_currency": {},
              "suggestion_balance": {},
              "ref": {},
              "narration": {},
              "manually_modified": {},
              "id": {},
              "display_name": {},
              "source_batch_payment_id": {
                "fields": {
                  "display_name": {}
                }
              }
            }
          },
          "available_reco_model_ids": {
            "fields": {
              "id": {},
              "display_name": {}
            }
          },
          "selected_reco_model_id": {
            "fields": {
              "display_name": {}
            }
          },
          "partner_name": {},
          "company_id": {
            "fields": {
              "display_name": {}
            }
          },
          "company_currency_id": {
            "fields": {
              "display_name": {}
            }
          },
          "matching_rules_allow_auto_reconcile": {},
          "state": {},
          "is_multi_currency": {},
          "selected_aml_ids": {},
          "todo_command": {},
          "return_todo_command": {},
          "form_index": {},
          "id": {},
          "display_name": {},
          "selected_batch_payment_ids": {},
          "matched_sale_order_ids": {}
        }
      ],
      "kwargs": {}
    }
  };

  let fechas = formatDateDiasAntesDespues(date, 7)

  const bankRecData = consumeEndpoint(payload, 'web/dataset/call_kw/bank.rec.widget/onchange');
  const amls = bankRecData.value?.return_todo_command?.amls;
  const domain = amls?.domain
  domain.unshift("&")
  domain.push(["partner_id", "=", partner_id]);
  domain.push(["date", ">=", fechas.antes]);
  domain.push(["date", "<=", fechas.despues]);
  domain.push(typeAccount);

  return { domain: domain, move_id: bankRecData.value?.move_id?.id, selected_aml_ids: bankRecData.value?.selected_aml_ids, line_ids: bankRecData.value?.line_ids };
}

function getAccountMoveLine(data, conciliation) {
  const payload = {
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
      "model": "account.move.line",
      "method": "web_search_read",
      "args": [],
      "kwargs": {
        "specification": {
          "company_id": {
            "fields": {}
          },
          "payment_id": {
            "fields": {}
          },
          "currency_id": {
            "fields": {}
          },
          "company_currency_id": {
            "fields": {}
          },
          "account_id": {
            "fields": {
              "display_name": {}
            }
          },
          "journal_id": {
            "fields": {
              "display_name": {}
            }
          },
          "partner_id": {
            "fields": {
              "display_name": {}
            }
          },
          "invoice_date": {},
          "date": {},
          "move_id": {
            "fields": {
              "display_name": {}
            }
          },
          "name": {},
          "date_maturity": {},
          "ref": {},
          "analytic_distribution": {},
          "analytic_precision": {},
          "amount_residual_currency": {},
          "amount_residual": {}
        },
        "offset": 0,
        "order": "",
        "limit": 40,
        "context": {
          "lang": "es_CO",
          "tz": "America/Lima",
          "uid": 14,
          "allowed_company_ids": [1, 2, 3, 4],
          "bin_size": true,
          "search_view_ref": "account_accountant.view_account_move_line_search_bank_rec_widget",
          "tree_view_ref": "account_accountant.view_account_move_line_list_bank_rec_widget",
          "preferred_aml_value": data?.amount,
          "preferred_aml_currency_id": data?.currency_id,
          "current_company_id": data?.company_id,
          "default_partner_id": data?.partner_id,
        },
        "count_limit": 41,
        "domain": data?.domain
      }
    }
  }

  const accountMoveLines = consumeEndpoint(payload, 'web/dataset/call_kw/account.move.line/web_search_read');
  const existingEntries = [];
  for (const accountLine of accountMoveLines.records) {
    let amoun_residual = parseInt(accountLine.amount_residual);
    let amount = parseInt(data.amount);
    let diferencia = amoun_residual - amount;

    let account_line_name = accountLine.account_id.display_name;
    let list_world_account = conciliation.name.split(" ");

    const world_exist = list_world_account.every(palabra =>
      account_line_name.includes(palabra)
    );

    /**
     * Tolerancia para el valor del amount
     */
    if (Math.abs(diferencia) <= 5 && world_exist) {
      existingEntries.push(accountLine);
    }
  }

  return existingEntries;
}

/**
 * Realiza una petición POST a un endpoint de Odoo usando session_id para autenticación.
 * @param {Object} payload - Datos que se enviarán en el cuerpo de la solicitud.
 * @param {string} extraURL - Ruta que se agregará a la URL base del servidor Odoo.
 * @returns {any|null} - Devuelve la propiedad `result` de la respuesta si es exitosa, o null si ocurre un error.
 */
function consumeEndpoint(payload, extraURL) {
  const url = 'https://ezerp.odoo.com';
  //const url = 'https://ezerptest.odoo.com';

  if (!session_id) throw new Error("Problemas para obtener el token de inicio de sesión.");

  const endpoint = `${url}/${extraURL}`;

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Cookie": session_id
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(endpoint, options);
    const data = JSON.parse(response.getContentText());

    return data.result;
  } catch (error) {
    throw new Error("Error obteniendo órdenes de compra: " + error);
  }
}

/**
 * Calcula una fecha 5 días antes y 5 días después de una fecha base.
 * 
 * @param {string} fechaStr - Fecha base en formato "yyyy-MM-dd" (por ejemplo: "2025-06-13").
 * @param {number} diasVariacion - Dias hacia delante y detras (por ejemplo: 5).
 * @returns {{antes: string, despues: string}} - Objeto con las fechas en formato "yyyy-MM-dd":
 *   - `antes`: fecha 5 días antes.
 *   - `despues`: fecha 5 días después.
 *
 * @example
 * const resultado = formatDateDiasAntesDespues("2025-06-13");
 * Logger.log(resultado.antes); // "2025-06-08"
 * Logger.log(resultado.despues); // "2025-06-18"
 *
 * @throws {Error} - Si el formato de la fecha es incorrecto o no se puede parsear.
 */
function formatDateDiasAntesDespues(fechaStr, diasVariacion) {

  let partes = fechaStr.split("-"); // ["2025", "06", "13"]

  // Crear objeto Date desde el string
  let fechaBase = new Date(partes[0], partes[1] - 1, partes[2]);

  // Clonar la fecha para no modificar la original
  let fechaAntes = new Date(fechaBase);
  let fechaDespues = new Date(fechaBase);

  // Restar y sumar días
  fechaAntes.setDate(fechaAntes.getDate() - diasVariacion);
  fechaDespues.setDate(fechaDespues.getDate() + diasVariacion);

  let timeZone = Session.getScriptTimeZone();
  let formatoDate = "yyyy-MM-dd";

  let fechaAntesStr = Utilities.formatDate(
    fechaAntes,
    timeZone,
    formatoDate)

  let fechaDespuesStr = Utilities.formatDate(
    fechaDespues,
    timeZone,
    formatoDate)

  return { antes: fechaAntesStr, despues: fechaDespuesStr }
}

function prueba() {
  let fecha = "2025-06-13";
  let fechas = formatDateDiasAntesDespues(fecha)

  console.log(fechas)
}
