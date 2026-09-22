package com.cereja.kanban.infrastructure.database.task;

import com.cereja.kanban.domain.Task.ITaskRepository; // Seu contrato
import com.cereja.kanban.domain.Task.Task; // Sua entidade pura
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component // Diz para o Spring instanciar essa classe
public class TaskRepositoryAdapter implements ITaskRepository {

    private final SpringDataTaskRepository springDataRepository;

    // Construtor: o Spring injeta a interface mágica aqui automaticamente
    public TaskRepositoryAdapter(SpringDataTaskRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Task save(Task task) {
        // 1. O domínio mandou uma "Task". Precisamos converter para "TaskEntity" para o banco entender.
        TaskEntity entity = new TaskEntity();
        entity.setId(task.getId());
        entity.setTitle(task.getTitle());
        entity.setDescription(task.getDescription());
        entity.setPhase(task.getPhase());
        entity.setPriority(task.getPriority());
        entity.setBoardId(task.getBoardId());
        entity.setAssigneeDiscordId(task.getAssigneeDiscordId());


        // 2. Salva no banco de dados usando o repositório do Spring
        TaskEntity savedEntity = springDataRepository.save(entity);

        // 3. Converte a resposta do banco (TaskEntity) de volta para o Domínio (Task)
        return converterParaDominio(savedEntity);
    }

    // Método auxiliar (privado) para te ajudar a converter de volta
    private Task converterParaDominio(TaskEntity entity) {
        Task task = new Task();
        task.setId(entity.getId());
        task.setTitle(entity.getTitle());
        task.setDescription(entity.getDescription());
        task.setPriority(entity.getPriority());
        task.setPhase(entity.getPhase());
        task.setBoardId(entity.getBoardId());
        task.setAssigneeDiscordId(entity.getAssigneeDiscordId());
        task.setCreatedAt(entity.getCreatedAt());
        task.setUpdatedAt(entity.getUpdatedAt());
        return task;
    }

    @Override
    public Optional<Task> findById(Long id) {
        // 1. O Spring busca no banco e devolve um pote: Optional<TaskEntity>
        Optional<TaskEntity> entityOptional = springDataRepository.findById(id);
        // 2. Se o pote estiver cheio, o .map() converte de TaskEntity para Task (usando nosso método auxiliar).
        // Se estiver vazio, ele só devolve o pote vazio.
        return entityOptional.map(this::converterParaDominio);
    }

    public List<Task> findAll(){
        return springDataRepository.findAll().stream().map(this::converterParaDominio).toList();
    }

    public void deleteById(Long id){
        springDataRepository.deleteById(id);
    }

    @Override
    public List<Task> findByBoardId(Long boardId){

        return springDataRepository.findByBoardId(boardId)
                .stream()
                .map(this::converterParaDominio)
                .toList();

    }

}