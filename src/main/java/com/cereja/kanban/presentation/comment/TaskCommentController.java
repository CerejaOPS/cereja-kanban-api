package com.cereja.kanban.presentation.comment;

import com.cereja.kanban.application.comment.AddCommentUseCase;
import com.cereja.kanban.application.comment.DeleteCommentUseCase;
import com.cereja.kanban.application.comment.GetCommentsByTaskIdUseCase;
import com.cereja.kanban.domain.comment.TaskComment;
import com.cereja.kanban.presentation.comment.DTO.CommentResponse;
import com.cereja.kanban.presentation.comment.DTO.CreateCommentRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/comments")
public class TaskCommentController {

    private final AddCommentUseCase addCommentUseCase;
    private final GetCommentsByTaskIdUseCase getCommentsByTaskIdUseCase;
    private final DeleteCommentUseCase deleteCommentUseCase;

    public TaskCommentController(
            AddCommentUseCase addCommentUseCase,
            GetCommentsByTaskIdUseCase getCommentsByTaskIdUseCase,
            DeleteCommentUseCase deleteCommentUseCase) {
        this.addCommentUseCase = addCommentUseCase;
        this.getCommentsByTaskIdUseCase = getCommentsByTaskIdUseCase;
        this.deleteCommentUseCase = deleteCommentUseCase;
    }

    @GetMapping
    public ResponseEntity<List<CommentResponse>> getComments(@PathVariable Long taskId) {
        List<CommentResponse> response = getCommentsByTaskIdUseCase.execute(taskId)
                .stream()
                .map(CommentResponse::fromDomain)
                .toList();
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable Long taskId,
            @Valid @RequestBody CreateCommentRequest request) {

        // Fallback seguro se não vier usuário preenchido (ex: ambiente dev/mock)
        String authorId = request.getAuthorDiscordId() != null ? request.getAuthorDiscordId() : "anonimo";
        String authorName = request.getAuthorName() != null ? request.getAuthorName() : "Desenvolvedor";
        String authorAvatar = request.getAuthorAvatar();

        TaskComment saved = addCommentUseCase.execute(
                taskId,
                authorId,
                authorName,
                authorAvatar,
                request.getContent()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(CommentResponse.fromDomain(saved));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable Long taskId,
            @PathVariable Long commentId,
            @RequestParam(required = false, defaultValue = "anonimo") String requesterDiscordId) {

        deleteCommentUseCase.execute(commentId, requesterDiscordId);
        return ResponseEntity.noContent().build();
    }
}