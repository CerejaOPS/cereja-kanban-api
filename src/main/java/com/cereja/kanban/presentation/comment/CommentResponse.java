package com.cereja.kanban.presentation.comment.DTO;

import com.cereja.kanban.domain.comment.TaskComment;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class CommentResponse {
    private Long id;
    private Long taskId;
    private String authorDiscordId;
    private String authorName;
    private String authorAvatar;
    private String content;
    private LocalDateTime createdAt;

    public static CommentResponse fromDomain(TaskComment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getTaskId(),
                comment.getAuthorDiscordId(),
                comment.getAuthorName(),
                comment.getAuthorAvatar(),
                comment.getContent(),
                comment.getCreatedAt()
        );
    }
}