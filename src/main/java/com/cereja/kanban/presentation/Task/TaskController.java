package com.cereja.kanban.presentation.Task;

import com.cereja.kanban.application.Task.MoveTaskUseCase;
import com.cereja.kanban.application.Task.TaskService;
import com.cereja.kanban.domain.Task.Task;
import com.cereja.kanban.presentation.Task.DTO.MoveTaskRequest;
import com.cereja.kanban.presentation.Task.DTO.CreateTaskRequest;
import com.cereja.kanban.presentation.Task.DTO.TaskResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final MoveTaskUseCase exibeTask; // <-- Adicionamos o nosso UseCase

    // Atualizamos o construtor para receber os dois!
    public TaskController(TaskService taskService, MoveTaskUseCase exibeTask) {
        this.taskService = taskService;
        this.exibeTask = exibeTask;
    }

    // ... (MANTENHA TODOS OS SEUS MÉTODOS AQUI: criar, listar, atualizar, deletar) ...
    // POST /api/task → Cria uma task
    @PostMapping
    public ResponseEntity<TaskResponse> criar(@Valid @RequestBody CreateTaskRequest request) {
        // 1. Converte o DTO para o domínio
        Task novoTask = new Task();
        novoTask.setTitle(request.getTitle());           // título vem do request
        novoTask.setDescription(request.getDescription()); // descrição vem do request
        novoTask.setPriority(request.getPriority());       // prioridade vem do request
        novoTask.setBoardId(request.getBoardId());         // board vem do request
        novoTask.setAssigneeDiscordId(request.getAssigneeDiscordId());

        // 2. Chama o Service
        Task taskSalva = taskService.createTask(novoTask);
        // 3. Converte o domínio para o DTO de resposta
        TaskResponse response = new TaskResponse(
                taskSalva.getId(),
                taskSalva.getTitle(),
                taskSalva.getDescription(),
                taskSalva.getPhase(),
                taskSalva.getPriority(),
                taskSalva.getBoardId(),
                taskSalva.getAssigneeDiscordId(),
                taskSalva.getCreatedAt(),
                taskSalva.getUpdatedAt()
        );
        // 4. Retorna com HTTP 201 (Created)
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> listarPorId(@PathVariable Long id) {

        // 1. Chama o Service
        Task taskEncontrada = taskService.findById(id);
        // 2. Converte para o DTO de resposta
        TaskResponse response = new TaskResponse(
                taskEncontrada.getId(),
                taskEncontrada.getTitle(),
                taskEncontrada.getDescription(),
                taskEncontrada.getPhase(),
                taskEncontrada.getPriority(),
                taskEncontrada.getBoardId(),
                taskEncontrada.getAssigneeDiscordId(),
                taskEncontrada.getCreatedAt(),
                taskEncontrada.getUpdatedAt()
        );
        // 3. Retorna HTTP 200 (OK)
        return ResponseEntity.ok(response);
    }

    // PUT /api/tasks/{id}
    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> atualizar(@PathVariable Long id, @Valid @RequestBody CreateTaskRequest request) {

        // 1. Converte o DTO (envelope) para o domínio
        Task dadosNovos = new Task();
        dadosNovos.setTitle(request.getTitle());
        dadosNovos.setDescription(request.getDescription());
        dadosNovos.setBoardId(request.getBoardId());
        dadosNovos.setPriority(request.getPriority());
        dadosNovos.setAssigneeDiscordId(request.getAssigneeDiscordId());

        // 2. Manda o Service atualizar (passando o ID e os dados novos)
        Task taskAtualizada = taskService.update(id, dadosNovos);
        // 3. Converte a task atualizada para o DTO de resposta
        TaskResponse response = new TaskResponse(
                taskAtualizada.getId(),
                taskAtualizada.getTitle(),
                taskAtualizada.getDescription(),
                taskAtualizada.getPhase(),
                taskAtualizada.getPriority(),
                taskAtualizada.getBoardId(),
                taskAtualizada.getAssigneeDiscordId(),
                taskAtualizada.getCreatedAt(),
                taskAtualizada.getUpdatedAt()
        );
        // 4. Retorna HTTP 200 (OK)
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<TaskResponse>> listarTodas() {
        // Pega as tasks do banco
        List<Task> tasks = taskService.findAll();
        // Converte a lista de 'Task' para uma lista de 'TaskResponse'
        List<TaskResponse> responses = tasks.stream()
                .map(task -> new TaskResponse(
                        task.getId(),
                        task.getTitle(),
                        task.getDescription(),
                        task.getPhase(),
                        task.getPriority(),
                        task.getBoardId(),
                        task.getAssigneeDiscordId(),
                        task.getCreatedAt(),
                        task.getUpdatedAt()
                ))
                .toList();
        return ResponseEntity.ok(responses);
    }

    // DELETE /api/tasks/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Long id) {
        taskService.deleteTask(id); // Chama o serviço para deletar

        // Retorna HTTP 204 (No Content) - Indica que deletou com sucesso e não tem nada para devolver
        return ResponseEntity.noContent().build();
    }


    /**
     * Move uma tarefa para uma nova fase do Kanban.
     * Retorna 204 No Content em caso de sucesso.
     *
     * @param id      ID da tarefa a ser movida.
     * @param request Corpo da requisição com a fase de destino e o responsável.
     */
    @PatchMapping("/{id}/move")
    public ResponseEntity<Void> moverTask(@PathVariable Long id, @Valid @RequestBody MoveTaskRequest request) {
        exibeTask.execute(id, request.getPhase(), request.getMovedBy());
        return ResponseEntity.noContent().build();
    }
}
