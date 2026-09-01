package com.cereja.kanban.repository;

import com.cereja.kanban.domain.Task.ITaskRepository;
import com.cereja.kanban.domain.Task.Task;
import com.cereja.kanban.domain.Task.TaskPhase;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class InMemoryTaskRepository implements ITaskRepository {

    // Simula a tabela do banco de dados na memória
    private final Map<Long, Task> tabelaTarefas = new HashMap<>();

    // CONSTRUTOR: Tudo o que estiver aqui dentro roda automaticamente quando a gaveta for criada
    public InMemoryTaskRepository() {
        Task tarefaTeste = new Task();
        tarefaTeste.setId(1L);
        tarefaTeste.setPhase(TaskPhase.TODO);

        tabelaTarefas.put(1L, tarefaTeste);
    }

    @Override
    public Optional<Task> findById(Long id) {
        // Busca a tarefa pela chave (ID) no mapa
        return Optional.ofNullable(tabelaTarefas.get(id));
    }

    @Override
    public void deleteById(Long id) {

    }

    @Override
    public Task save(Task task) {
        // Salva ou atualiza a tarefa no mapa
        tabelaTarefas.put(task.getId(), task);
        return task;
    }

    @Override
    public List<Task> findAll() {
        return List.of();
    }
}