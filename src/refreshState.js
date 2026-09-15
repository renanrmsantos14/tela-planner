function omitCoreOwnedData(source = {}) {
  const {
    notifications: _notifications,
    quotes: _quotes,
    quality: _quality,
    ...rest
  } = source;
  return rest;
}

function omitSupplementalUnrelatedData(source = {}) {
  const { notifications: _notifications, tasks: _tasks, ...rest } = source;
  return rest;
}

function preserveLoadedTaskDetails(tasks = [], currentTasks = []) {
  const currentById = new Map(currentTasks.map((task) => [task.id, task]));
  return tasks.map((task) => {
    const current = currentById.get(task.id);
    if (!current?.detailsLoaded) return task;
    const details = { detailsLoaded: true };
    for (const key of ["comments", "returns", "history", "attachments", "detailsError"]) {
      if (current[key] !== undefined) details[key] = current[key];
    }
    return {
      ...task,
      ...details,
    };
  });
}

export function buildBackgroundRefreshPatch(current = {}, core = {}, results = {}) {
  const { loading: coreLoading, ...coreData } = omitCoreOwnedData(core);
  const patch = {
    ...coreData,
    loading: {
      ...(current.loading || {}),
      core: coreLoading?.core ?? current.loading?.core,
    },
  };
  if (Array.isArray(coreData.tasks)) {
    patch.tasks = preserveLoadedTaskDetails(coreData.tasks, current.tasks || []);
  }

  if (results.supplemental?.status === "fulfilled") {
    Object.assign(patch, omitSupplementalUnrelatedData(results.supplemental.value));
  }

  if (results.photos?.status === "fulfilled") {
    Object.assign(patch, results.photos.value || {});
  }

  if (results.contacts?.status === "fulfilled") {
    patch.contacts = results.contacts.value || [];
    patch.contactLoading = false;
    patch.contactLoadError = "";
  }

  return patch;
}
