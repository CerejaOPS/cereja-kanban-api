package com.cereja.kanban.application.events;

public interface IBoardEventPublisher {

    void publish(Long boardId, String eventName, Object payload);
}