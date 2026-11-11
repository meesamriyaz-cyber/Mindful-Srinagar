export const taskManagers = ["director", "admin", "coordinator", "reception"];
export function taskScope(req) {
  return taskManagers.includes(req.user.role) ? {} : { assignedTo: req.user._id };
}
