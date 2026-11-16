package com.cereja.kanban.domain.comment;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class TaskComment {
    private Long id;
    private Long taskId;
    private String authorDiscordId;
    private String authorName;
    private String authorAvatar;
    private String content;
    private LocalDateTime createdAt;
}
