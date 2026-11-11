const transitions = {
  todo: ["in-progress", "done"],
  "in-progress": ["todo", "done"],
  done: []
};

export function canTransitionTask(current, next) {
  return current === next || Boolean(transitions[current]?.includes(next));
}

export function validateTaskPayload(payload) {
  if (payload.title !== undefined && (typeof payload.title !== "string" || !payload.title.trim() || payload.title.trim().length > 180)) {
    return "Task title must contain 1 to 180 characters";
  }
  if (payload.dueDate !== undefined && payload.dueDate !== null && payload.dueDate !== "") {
    const date = new Date(payload.dueDate);
    if (Number.isNaN(date.getTime())) return "Provide a valid task due date";
  }
  if (payload.priority !== undefined && !["low", "medium", "high"].includes(payload.priority)) return "Choose a valid task priority";
  if (payload.status !== undefined && !["todo", "in-progress", "done"].includes(payload.status)) return "Choose a valid task status";
  if (payload.department !== undefined && !["front-desk", "clinical", "accounts", "outreach", "operations"].includes(payload.department)) return "Choose a valid task department";
  return null;
}
