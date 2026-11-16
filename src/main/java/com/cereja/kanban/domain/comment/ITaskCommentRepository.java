package com.cereja.kanban.domain.comment;


import com.cereja.kanban.domain.Board.Board;

import java.util.List;
import java.util.Optional;

public interface ITaskCommentRepository {
    TaskComment save(TaskComment taskComment);
    List<TaskComment> findByTaskId(Long taskId);
    Optional<TaskComment> findById(Long id);
    void deleteById(Long id);
}
