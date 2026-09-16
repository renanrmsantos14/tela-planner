import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { canEditQuoteServiceTypes, createQuoteServiceType, updateQuoteServiceType } from "./dataverse.js";
import { useQuoteServiceTypes } from "./useQuoteServiceTypes.js";

export default function ServiceTypeManager({ live }) {
  const editable = live && canEditQuoteServiceTypes();
  const { options, error: loadError } = useQuoteServiceTypes();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [toArchive, setToArchive] = useState(null);
  const refresh = () => window.dispatchEvent(new Event("planner-service-types-changed"));
  const create = async (event) => {
    event.preventDefault(); setPending(true); setError("");
    try { await createQuoteServiceType(name); setName(""); refresh(); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  };
  const rename = async (item, input) => {
    const next = input.value.trim();
    if (next === item.name) return;
    setPending(true); setError("");
    try { await updateQuoteServiceType(item.id, { name: next }); refresh(); }
    catch (failure) { input.value = item.name; setError(failure.message); }
    finally { setPending(false); }
  };
  const archive = async (item) => {
    setPending(true); setError("");
    try { await updateQuoteServiceType(item.id, { archived: true }); setToArchive(null); refresh(); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  };
  return <section className="panel personal-tags-settings-panel" aria-labelledby="service-types-title">
    <div className="panel-heading"><div><span className="eyebrow">Cotações</span><h2 id="service-types-title">Tipos de serviço</h2><p className="panel-copy">Cadastre os tipos disponíveis para as cotações. Tipos arquivados permanecem nos registros existentes.</p></div></div>
    <div className="personal-tag-manager" aria-label="Gerenciar tipos de serviço">
      <form className="personal-tag-create" onSubmit={create}><input value={name} onChange={(event) => setName(event.target.value.slice(0, 100))} maxLength={100} placeholder="Novo tipo de serviço" aria-label="Nome do novo tipo de serviço" disabled={!editable || pending} /><button className="button button-secondary button-small" type="submit" disabled={!editable || pending || !name.trim()}><Plus size={14} /> Adicionar</button></form>
      <div className="personal-tag-manager-list">{options.filter((item) => !item.archived).map((item) => <div className="personal-tag-manager-row" key={item.id}>
        <input className="personal-tag-badge" key={`${item.id}-${item.name}`} defaultValue={item.name} maxLength={100} aria-label={`Nome do tipo ${item.name}`} disabled={!editable || pending} onBlur={(event) => rename(item, event.target)} />
        <div className="personal-tag-manager-actions">{toArchive?.id === item.id ? <div className="subtask-remove-confirm" role="group" aria-label={`Confirmar arquivamento de ${item.name}`}><button className="button button-danger" type="button" disabled={pending} onClick={() => archive(item)}>Arquivar</button><button className="button button-quiet" type="button" onClick={() => setToArchive(null)}>Cancelar</button></div> : <button className="subtask-delete" type="button" disabled={!editable || pending} onClick={() => setToArchive(item)} aria-label={`Arquivar ${item.name}`} title="Arquivar tipo"><Trash2 size={13} /></button>}</div>
      </div>)}</div>
      {options.some((item) => item.archived) && <details><summary>Arquivados ({options.filter((item) => item.archived).length})</summary><div className="personal-tag-manager-list">{options.filter((item) => item.archived).map((item) => <div className="personal-tag-manager-row" key={item.id}><span>{item.name}</span><button className="button button-quiet button-small" type="button" disabled={!editable || pending} onClick={async () => { setPending(true); setError(""); try { await updateQuoteServiceType(item.id, { archived: false }); refresh(); } catch (failure) { setError(failure.message); } finally { setPending(false); } }}>Reativar</button></div>)}</div></details>}
      {!editable && live && <p className="panel-copy">Edição disponível somente no DEV.</p>}
      {(error || loadError) && <p role="alert">{error || loadError}</p>}
    </div>
  </section>;
}
